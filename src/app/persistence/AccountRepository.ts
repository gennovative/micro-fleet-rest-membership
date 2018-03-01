import { QueryBuilder } from 'objection';
import * as scrypt from 'scrypt';
import { inject, injectable, Guard } from 'back-lib-common-util';
import { RepositoryBase, IDatabaseConnector, Types as PerTypes } from 'back-lib-persistence';
import { AccountDTO, IAccountRepository } from 'back-lib-membership-contracts';

import { AccountEntity } from '../entity/AccountEntity';
import { isMaster } from 'cluster';

@injectable()
export class AccountRepository
	extends RepositoryBase<AccountEntity, AccountDTO>
	implements IAccountRepository {
	
	constructor(
		@inject(PerTypes.DB_CONNECTOR) dbConnector: IDatabaseConnector,
		) {
		super(AccountEntity, dbConnector);
	}

	/**
	 * @override
	 */
	public async create(model: AccountDTO, opts?): Promise<AccountDTO & AccountDTO[]> {
		const passBuffer = await this.hash(model.password);
		const password = passBuffer.toString('base64');
		model = AccountDTO.translator.merge(model, {
			password
		}) as AccountDTO;
		return await super.create(model, opts);
	}

	public async findByCredentials(username: string, password: string): Promise<AccountDTO> {
		let queryProm: Promise<AccountDTO> = this._processor.executeQuery((builder: QueryBuilder<AccountDTO>) => {
			let query = builder
				.where('username', username)
				.limit(1);
				// console.log(query.toSQL());
				return query;
		});
		const account = await queryProm;
		const passBuffer = Buffer.from(account[0].password, 'base64');
		const isMatched = await this.verify(passBuffer, password);
		return (isMatched ? account[0] : null);
	}


	private async hash(password: string): Promise<Buffer> {
		let params = await scrypt.params(0.1);
		return await scrypt.kdf(password, params);
	}

	private verify(kdf: Buffer, key: string): Promise<boolean> {
		return scrypt.verifyKdf(kdf, key);
	}
}