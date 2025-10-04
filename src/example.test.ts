import {
  Collection,
  Entity,
  ManyToMany,
  ManyToOne,
  MikroORM,
  PrimaryKeyProp,
  Property,
  Ref,
  Reference,
} from '@mikro-orm/sqlite';
import { v4 as uuid } from 'uuid';

@Entity({ tableName: 'tenants' })
class TenantEntity {
  @Property({ type: 'uuid', primary: true })
  id: string = uuid();

  @Property({ type: 'string' })
  name!: string;
}

@Entity({ tableName: 'auth_roles' })
class AuthRoleEntity {
  @Property({ type: 'uuid', primary: true })
  id: string = uuid();

  @ManyToOne({
    entity: () => TenantEntity,
    fieldName: 'tenant_id',
    primary: true,
  })
  tenant!: Ref<TenantEntity>;

  @Property({ type: 'string' })
  name!: string;

  @ManyToMany({ entity: () => UserProfileEntity, mappedBy: 'roles' })
  userProfiles = new Collection<UserProfileEntity>(this);
}

@Entity({ tableName: 'user_profiles' })
class UserProfileEntity {
  @Property({ type: 'uuid', primary: true })
  id: string = uuid();

  @ManyToOne({
    entity: () => TenantEntity,
    fieldName: 'tenant_id',
    primary: true,
  })
  tenant!: Ref<TenantEntity>;

  @Property({ type: 'string' })
  name!: string;

  @ManyToMany({
    entity: () => AuthRoleEntity,
    pivotEntity: () => AuthUserRoleEntity,
    owner: true,
  })
  roles = new Collection<AuthRoleEntity>(this);
}

@Entity({ tableName: 'auth_user_roles' })
class AuthUserRoleEntity {
  [PrimaryKeyProp]?: ['userProfile', 'role'];

  @ManyToOne({
    entity: () => UserProfileEntity,
    primary: true,
    updateRule: 'no action',
    deleteRule: 'no action',
    joinColumns: ['user_profile_id', 'tenant_id'],
    referencedColumnNames: ['id', 'tenant_id'],
    ref: true,
  })
  userProfile!: Ref<UserProfileEntity>;

  @ManyToOne({
    entity: () => AuthRoleEntity,
    primary: true,
    updateRule: 'no action',
    deleteRule: 'no action',
    joinColumns: ['role_id', 'tenant_id'],
    referencedColumnNames: ['id', 'tenant_id'],
    ref: true,
  })
  role!: Ref<AuthRoleEntity>;

  @ManyToOne({
    entity: () => TenantEntity,
    fieldName: 'tenant_id',
    primary: true,
  })
  tenant!: Ref<TenantEntity>;

  @Property({ type: 'timestamp', defaultRaw: 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  constructor(userProfile: UserProfileEntity, role: AuthRoleEntity) {
    this.userProfile = Reference.create(userProfile);
    this.role = Reference.create(role);
  }
}

let orm: MikroORM;

beforeAll(async () => {
  orm = await MikroORM.init({
    dbName: ':memory:',
    entities: [
      TenantEntity,
      AuthRoleEntity,
      UserProfileEntity,
      AuthUserRoleEntity,
    ],
    debug: ['query', 'query-params'],
    allowGlobalContext: true, // only for testing
  });
  await orm.schema.refreshDatabase();
});

afterAll(async () => {
  await orm.close(true);
});

test('basic CRUD example', async () => {
  const tenant = orm.em.create(TenantEntity, { name: 'Tenant 1' });
  await orm.em.flush();

  const userProfile = orm.em.create(UserProfileEntity, { name: 'John Doe', tenant });
  const role = orm.em.create(AuthRoleEntity, { name: 'Admin', tenant });
  await orm.em.flush();

  const userRole = new AuthUserRoleEntity(userProfile, role)
  userRole.tenant = Reference.create(tenant)

  orm.em.create(AuthUserRoleEntity, userRole);
  await orm.em.flush();

  const user = await orm.em.findOneOrFail(UserProfileEntity, { name: 'John Doe' }, {populate: ['roles']});
  expect(user.roles[0].name).toBe('Admin');
});
