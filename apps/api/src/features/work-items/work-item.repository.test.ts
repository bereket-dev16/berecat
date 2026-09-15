import { describe, expect, it, vi } from 'vitest';

import {
  workItemAssignees,
  workItemComments,
  workItemEvents,
  workItems,
} from '../../db/schema/index.js';
import type { MasterDataWorkItemValues } from '../master-data/master-data.types.js';
import { createWorkItemRepository } from './work-item.repository.js';
import type {
  NormalizedCreateWorkItemInput,
  NormalizedUpdateWorkItemInput,
  WorkItemRepository,
} from './work-item.types.js';

const CREATOR_ID = '00000000-0000-4000-8000-000000000001';
const ASSIGNEE_ID = '00000000-0000-4000-8000-000000000002';
const WORK_ITEM_ID = '10000000-0000-4000-8000-000000000001';

function createRepository(
  database: unknown,
  syncMasterData = vi.fn(async () => undefined),
): WorkItemRepository {
  return createWorkItemRepository(database as never, {
    syncMasterData: syncMasterData as never,
  });
}

interface WorkflowTransactionHarness {
  database: { transaction: ReturnType<typeof vi.fn> };
  transaction: ReturnType<typeof vi.fn>;
  forUpdate: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  updateSet: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  insertValues: ReturnType<typeof vi.fn>;
  getCallbackCount(): number;
  getCommitCount(): number;
  getRollbackCount(): number;
  getCommittedUpdates(): unknown[];
}

function createFailingWorkflowTransactionHarness(
  selectedWorkItem: Record<string, string>,
): WorkflowTransactionHarness {
  let callbackCount = 0;
  let commitCount = 0;
  let rollbackCount = 0;
  let stagedUpdates: unknown[] = [];
  const committedUpdates: unknown[] = [];
  let pendingUpdate: unknown;

  const forUpdate = vi.fn(async () => [selectedWorkItem]);
  const select = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(() => ({ for: forUpdate })),
      })),
    })),
  }));
  const updateWhere = vi.fn(async () => {
    stagedUpdates.push(pendingUpdate);
  });
  const updateSet = vi.fn((values: unknown) => {
    pendingUpdate = values;
    return { where: updateWhere };
  });
  const update = vi.fn(() => ({ set: updateSet }));
  const insertValues = vi.fn(async () => {
    throw new Error('Test etkinlik insert hatası.');
  });
  const insert = vi.fn(() => ({ values: insertValues }));
  const transactionClient = { select, update, insert };
  const transaction = vi.fn(
    async (
      callback: (client: typeof transactionClient) => Promise<unknown>,
    ) => {
      callbackCount += 1;
      stagedUpdates = [];

      try {
        const result = await callback(transactionClient);
        committedUpdates.push(...stagedUpdates);
        commitCount += 1;
        return result;
      } catch (error: unknown) {
        stagedUpdates = [];
        rollbackCount += 1;
        throw error;
      }
    },
  );

  return {
    database: { transaction },
    transaction,
    forUpdate,
    update,
    updateSet,
    insert,
    insertValues,
    getCallbackCount: () => callbackCount,
    getCommitCount: () => commitCount,
    getRollbackCount: () => rollbackCount,
    getCommittedUpdates: () => committedUpdates,
  };
}

const CREATE_INPUT: NormalizedCreateWorkItemInput = {
  moduleKey: 'incoming-orders',
  orderCode: null,
  companyName: 'Test Firması',
  productName: 'Test Ürünü',
  packagingType: null,
  supplierCompany: null,
  orderType: null,
  stockValue: null,
  needOrderValue: null,
  orderedQuantity: null,
  receivedQuantity: null,
  orderReceivedDate: null,
  orderPlacedDate: null,
  orderDeadlineDate: null,
  orderShipmentDate: null,
  processStage: null,
  productDetail: null,
  assigneeIds: [ASSIGNEE_ID],
};

const MASTER_DATA_CREATE_INPUT: NormalizedCreateWorkItemInput = {
  ...CREATE_INPUT,
  companyName: 'Yeni Firma',
  productName: 'Yeni Ürün',
  packagingType: 'Kutu',
  supplierCompany: 'Tedarikçi',
  orderType: 'Yurt İçi',
  processStage: 'Baskı',
  assigneeIds: [],
};

function createSuccessfulCreateHarness() {
  let createdSequence = 0;
  const returning = vi.fn(async () => {
    createdSequence += 1;

    return [
      {
        id: `10000000-0000-4000-8000-${String(createdSequence).padStart(12, '0')}`,
        moduleKey: MASTER_DATA_CREATE_INPUT.moduleKey,
        productName: MASTER_DATA_CREATE_INPUT.productName,
        companyName: MASTER_DATA_CREATE_INPUT.companyName,
        productDetail: MASTER_DATA_CREATE_INPUT.productDetail,
        orderDeadlineDate: MASTER_DATA_CREATE_INPUT.orderDeadlineDate,
        status: 'active',
        completedAt: null,
      },
    ];
  });
  const insertValues = vi.fn(() => ({ returning }));
  const insert = vi.fn(() => ({ values: insertValues }));
  const transactionClient = { insert };
  const transaction = vi.fn(
    async (
      callback: (client: typeof transactionClient) => Promise<unknown>,
    ) => callback(transactionClient),
  );
  const outerSelect = vi.fn(() => ({
    from: vi.fn(() => ({
      innerJoin: vi.fn(() => ({
        where: vi.fn(() => ({ orderBy: vi.fn(async () => []) })),
      })),
    })),
  }));

  return {
    database: { transaction, select: outerSelect },
    transactionClient,
    transaction,
    insert,
  };
}

describe('production repository master data create senkronizasyonu', () => {
  it('altı ana veri alanını iş kaydıyla aynı transaction clientına aktarır', async () => {
    const harness = createSuccessfulCreateHarness();
    const syncMasterData = vi.fn(async () => undefined);
    const repository = createRepository(harness.database, syncMasterData);

    const result = await repository.createWithAssignees(
      MASTER_DATA_CREATE_INPUT,
      CREATOR_ID,
    );

    expect(result.status).toBe('created');
    expect(harness.transaction).toHaveBeenCalledTimes(1);
    expect(syncMasterData).toHaveBeenCalledTimes(1);
    expect(syncMasterData).toHaveBeenCalledWith(
      harness.transactionClient,
      {
        companyName: 'Yeni Firma',
        productName: 'Yeni Ürün',
        packagingType: 'Kutu',
        supplierCompany: 'Tedarikçi',
        orderType: 'Yurt İçi',
        processStage: 'Baskı',
      },
    );
  });

  it('çoğaltma tarafından yeniden kullanılan create akışında tekrar senkronize eder', async () => {
    const harness = createSuccessfulCreateHarness();
    const syncMasterData = vi.fn(async () => undefined);
    const repository = createRepository(harness.database, syncMasterData);

    await repository.createWithAssignees(
      MASTER_DATA_CREATE_INPUT,
      CREATOR_ID,
    );
    await repository.createWithAssignees(
      MASTER_DATA_CREATE_INPUT,
      CREATOR_ID,
    );

    expect(harness.transaction).toHaveBeenCalledTimes(2);
    expect(syncMasterData).toHaveBeenCalledTimes(2);
  });

  it('master data senkronizasyonu başarısızsa iş ve atamaları commit etmez', async () => {
    const stagedOperations: string[] = [];
    const committedOperations: string[] = [];
    let rollbackCount = 0;
    const select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => [{ id: ASSIGNEE_ID }]),
      })),
    }));
    const returning = vi.fn(async () => {
      stagedOperations.push('work-item');
      return [
        {
          id: WORK_ITEM_ID,
          moduleKey: CREATE_INPUT.moduleKey,
          productName: CREATE_INPUT.productName,
          companyName: CREATE_INPUT.companyName,
          productDetail: CREATE_INPUT.productDetail,
          orderDeadlineDate: CREATE_INPUT.orderDeadlineDate,
          status: 'active',
          completedAt: null,
        },
      ];
    });
    const insert = vi.fn((table: unknown) => {
      if (table === workItems) {
        return { values: vi.fn(() => ({ returning })) };
      }

      return {
        values: vi.fn(async () => {
          stagedOperations.push('assignees');
        }),
      };
    });
    const transactionClient = { select, insert };
    const transaction = vi.fn(
      async (
        callback: (client: typeof transactionClient) => Promise<unknown>,
      ) => {
        try {
          const result = await callback(transactionClient);
          committedOperations.push(...stagedOperations);
          return result;
        } catch (error: unknown) {
          stagedOperations.length = 0;
          rollbackCount += 1;
          throw error;
        }
      },
    );
    const syncMasterData = vi.fn(async () => {
      throw new Error('Test master data sync hatası.');
    });
    const repository = createRepository({ transaction }, syncMasterData);

    await expect(
      repository.createWithAssignees(CREATE_INPUT, CREATOR_ID),
    ).rejects.toThrow('Test master data sync hatası.');

    expect(insert).toHaveBeenCalledWith(workItems);
    expect(insert).toHaveBeenCalledWith(workItemAssignees);
    expect(syncMasterData).toHaveBeenCalledWith(
      transactionClient,
      expect.objectContaining({
        companyName: CREATE_INPUT.companyName,
        productName: CREATE_INPUT.productName,
      }),
    );
    expect(committedOperations).toEqual([]);
    expect(rollbackCount).toBe(1);
  });

  it('atama doğrulaması başarısızsa master data senkronizasyonu başlatmaz', async () => {
    const select = vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn(async () => []) })),
    }));
    const transactionClient = { select };
    const transaction = vi.fn(
      async (
        callback: (client: typeof transactionClient) => Promise<unknown>,
      ) => callback(transactionClient),
    );
    const syncMasterData = vi.fn(async () => undefined);
    const repository = createRepository({ transaction }, syncMasterData);

    const result = await repository.createWithAssignees(
      CREATE_INPUT,
      CREATOR_ID,
    );

    expect(result).toEqual({ status: 'invalid-assignees' });
    expect(syncMasterData).not.toHaveBeenCalled();
  });
});

describe('work item repository transaction sınırı', () => {
  it('ilk atama inserti başarısızsa oluşturulan işi commit etmez', async () => {
    const committedWorkItems: string[] = [];
    let stagedWorkItems: string[] = [];
    let insertSequence = 0;

    const transaction = vi.fn(
      async (
        callback: (transactionClient: {
          select: () => {
            from: () => {
              where: () => Promise<Array<{ id: string }>>;
            };
          };
          insert: () => {
            values: () =>
              | Promise<never>
              | {
                  returning: () => Promise<
                    Array<{
                      id: string;
                      moduleKey: string;
                      productName: string;
                      companyName: string;
                      productDetail: null;
                      orderDeadlineDate: null;
                      status: string;
                      completedAt: null;
                    }>
                  >;
                };
          };
        }) => Promise<unknown>,
      ) => {
        stagedWorkItems = [];

        const transactionClient = {
          select: () => ({
            from: () => ({
              where: async () => [{ id: ASSIGNEE_ID }],
            }),
          }),
          insert: () => {
            insertSequence += 1;

            if (insertSequence === 1) {
              return {
                values: () => ({
                  returning: async () => {
                    stagedWorkItems.push(WORK_ITEM_ID);
                    return [
                      {
                        id: WORK_ITEM_ID,
                        moduleKey: 'incoming-orders',
                        productName: 'Test Ürünü',
                        companyName: 'Test Firması',
                        productDetail: null,
                        orderDeadlineDate: null,
                        status: 'active',
                        completedAt: null,
                      },
                    ];
                  },
                }),
              };
            }

            return {
              values: async () => {
                throw new Error('Test atama insert hatası.');
              },
            };
          },
        };

        try {
          const result = await callback(transactionClient);
          committedWorkItems.push(...stagedWorkItems);
          return result;
        } catch (error: unknown) {
          stagedWorkItems = [];
          throw error;
        }
      },
    );

    const syncMasterData = vi.fn(async () => undefined);
    const repository = createRepository({ transaction }, syncMasterData);

    await expect(
      repository.createWithAssignees(CREATE_INPUT, CREATOR_ID),
    ).rejects.toThrow('Test atama insert hatası.');

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(committedWorkItems).toEqual([]);
    expect(stagedWorkItems).toEqual([]);
  });
});

const WORKFLOW_TRANSACTION_CASES: Array<{
  name: string;
  selectedWorkItem: Record<string, string>;
  invoke(repository: WorkItemRepository): Promise<unknown>;
  expectedUpdate: Record<string, unknown>;
  expectedEvent: Record<string, unknown>;
}> = [
  {
    name: 'move',
    selectedWorkItem: {
      id: WORK_ITEM_ID,
      moduleKey: 'incoming-orders',
      status: 'active',
    },
    invoke: (repository) =>
      repository.move(WORK_ITEM_ID, 'digital', CREATOR_ID),
    expectedUpdate: { moduleKey: 'digital' },
    expectedEvent: {
      workItemId: WORK_ITEM_ID,
      actorId: CREATOR_ID,
      eventType: 'moved',
      fromModuleKey: 'incoming-orders',
      toModuleKey: 'digital',
    },
  },
  {
    name: 'complete',
    selectedWorkItem: { id: WORK_ITEM_ID, status: 'active' },
    invoke: (repository) => repository.complete(WORK_ITEM_ID, CREATOR_ID),
    expectedUpdate: {
      status: 'completed',
      completedBy: CREATOR_ID,
    },
    expectedEvent: {
      workItemId: WORK_ITEM_ID,
      actorId: CREATOR_ID,
      eventType: 'completed',
    },
  },
  {
    name: 'reopen',
    selectedWorkItem: { id: WORK_ITEM_ID, status: 'completed' },
    invoke: (repository) => repository.reopen(WORK_ITEM_ID, CREATOR_ID),
    expectedUpdate: {
      status: 'active',
      completedAt: null,
      completedBy: null,
    },
    expectedEvent: {
      workItemId: WORK_ITEM_ID,
      actorId: CREATOR_ID,
      eventType: 'reopened',
    },
  },
];

describe.each(WORKFLOW_TRANSACTION_CASES)(
  'production repository $name transaction sınırı',
  ({ selectedWorkItem, invoke, expectedUpdate, expectedEvent }) => {
    it('kilit, update ve event insertini tek transaction clientında atomik tutar', async () => {
      const harness = createFailingWorkflowTransactionHarness(
        selectedWorkItem,
      );
      const repository = createRepository(harness.database);

      await expect(invoke(repository)).rejects.toThrow(
        'Test etkinlik insert hatası.',
      );

      expect(harness.transaction).toHaveBeenCalledTimes(1);
      expect(harness.getCallbackCount()).toBe(1);
      expect(harness.forUpdate).toHaveBeenCalledTimes(1);
      expect(harness.forUpdate).toHaveBeenCalledWith('update');
      expect(harness.update).toHaveBeenCalledTimes(1);
      expect(harness.update).toHaveBeenCalledWith(workItems);
      expect(harness.updateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          ...expectedUpdate,
          updatedAt: expect.any(Date),
        }),
      );
      expect(harness.insert).toHaveBeenCalledTimes(1);
      expect(harness.insert).toHaveBeenCalledWith(workItemEvents);
      expect(harness.insertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          ...expectedEvent,
          createdAt: expect.any(Date),
        }),
      );

      const updateValues = harness.updateSet.mock.calls[0]?.[0] as {
        updatedAt: Date;
      };
      const eventValues = harness.insertValues.mock.calls[0]?.[0] as {
        createdAt: Date;
      };
      expect(eventValues.createdAt).toBe(updateValues.updatedAt);
      expect(harness.getCommitCount()).toBe(0);
      expect(harness.getRollbackCount()).toBe(1);
      expect(harness.getCommittedUpdates()).toEqual([]);
    });
  },
);

describe('production repository yorum transaction sınırı', () => {
  it('parent doğrulaması ve reply insertini aynı transaction clientında yapar', async () => {
    const parentCommentId = '20000000-0000-4000-8000-000000000001';
    const createdAt = new Date('2026-09-14T10:00:00.000Z');
    let selectSequence = 0;
    const forShare = vi.fn(async () => [{ id: WORK_ITEM_ID }]);
    const select = vi.fn(() => {
      selectSequence += 1;

      if (selectSequence === 1) {
        return {
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(() => ({ for: forShare })),
            })),
          })),
        };
      }

      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [
              {
                id: parentCommentId,
                workItemId: WORK_ITEM_ID,
                parentCommentId: null,
              },
            ]),
          })),
        })),
      };
    });
    const returning = vi.fn(async () => [
      {
        id: '20000000-0000-4000-8000-000000000002',
        body: 'Yanıt',
        parentCommentId,
        createdAt,
      },
    ]);
    const values = vi.fn(() => ({ returning }));
    const insert = vi.fn(() => ({ values }));
    const transactionClient = { select, insert };
    const transaction = vi.fn(
      async (
        callback: (client: typeof transactionClient) => Promise<unknown>,
      ) => callback(transactionClient),
    );
    const repository = createRepository({ transaction });

    const result = await repository.addComment(
      WORK_ITEM_ID,
      'Yanıt',
      parentCommentId,
      {
        id: CREATOR_ID,
        username: 'test-kullanicisi',
        displayName: 'Test Kullanıcısı',
        role: 'member',
        team: 'graphic',
      },
    );

    expect(result).toEqual({
      status: 'created',
      comment: {
        id: '20000000-0000-4000-8000-000000000002',
        body: 'Yanıt',
        parentCommentId,
        createdAt: createdAt.toISOString(),
        reactionCount: 0,
        reactedByCurrentUser: false,
        author: {
          id: CREATOR_ID,
          username: 'test-kullanicisi',
          displayName: 'Test Kullanıcısı',
        },
      },
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledTimes(2);
    expect(forShare).toHaveBeenCalledTimes(1);
    expect(forShare).toHaveBeenCalledWith('share');
    expect(insert).toHaveBeenCalledWith(workItemComments);
    expect(values).toHaveBeenCalledWith({
      workItemId: WORK_ITEM_ID,
      body: 'Yanıt',
      authorId: CREATOR_ID,
      parentCommentId,
    });
  });
});

const UPDATE_INPUT: NormalizedUpdateWorkItemInput = {
  orderCode: 'BR-02D',
  companyName: 'Güncel Firma',
  productName: 'Güncel Ürün',
  packagingType: null,
  supplierCompany: null,
  orderType: null,
  stockValue: null,
  needOrderValue: null,
  orderedQuantity: null,
  receivedQuantity: null,
  orderReceivedDate: null,
  orderPlacedDate: null,
  orderDeadlineDate: null,
  orderShipmentDate: null,
  processStage: 'Baskı',
  productDetail: 'Kutu',
  assigneeIds: [ASSIGNEE_ID],
};

const PREVIOUS_MASTER_DATA_VALUES: MasterDataWorkItemValues = {
  companyName: 'Eski Firma',
  productName: 'Eski Ürün',
  packagingType: 'Şişe',
  supplierCompany: 'Eski Tedarikçi',
  orderType: 'İthal',
  processStage: 'Tasarım',
};

const MASTER_DATA_UPDATE_INPUT: NormalizedUpdateWorkItemInput = {
  ...UPDATE_INPUT,
  packagingType: 'Kutu',
  supplierCompany: 'Yeni Tedarikçi',
  orderType: 'Yurt İçi',
  assigneeIds: [],
};

function createSuccessfulUpdateHarness(
  lockedMasterDataValues: MasterDataWorkItemValues =
    PREVIOUS_MASTER_DATA_VALUES,
) {
  const forUpdate = vi.fn(async () => [
    {
      id: WORK_ITEM_ID,
      status: 'active',
      ...lockedMasterDataValues,
    },
  ]);
  const transactionSelect = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(() => ({ for: forUpdate })),
      })),
    })),
  }));
  const updateWhere = vi.fn(async () => undefined);
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set: updateSet }));
  const deleteWhere = vi.fn(async () => undefined);
  const deleteQuery = vi.fn(() => ({ where: deleteWhere }));
  const transactionClient = {
    select: transactionSelect,
    update,
    delete: deleteQuery,
  };
  const transaction = vi.fn(
    async (
      callback: (client: typeof transactionClient) => Promise<unknown>,
    ) => callback(transactionClient),
  );
  let outerSelectSequence = 0;
  const outerSelect = vi.fn(() => {
    outerSelectSequence += 1;

    if (outerSelectSequence === 1) {
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [
              {
                id: WORK_ITEM_ID,
                moduleKey: 'incoming-orders',
                productName: MASTER_DATA_UPDATE_INPUT.productName,
                companyName: MASTER_DATA_UPDATE_INPUT.companyName,
                productDetail: MASTER_DATA_UPDATE_INPUT.productDetail,
                orderDeadlineDate:
                  MASTER_DATA_UPDATE_INPUT.orderDeadlineDate,
                status: 'active',
                completedAt: null,
              },
            ]),
          })),
        })),
      };
    }

    return {
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({ orderBy: vi.fn(async () => []) })),
        })),
      })),
    };
  });

  return {
    database: { transaction, select: outerSelect },
    transactionClient,
    transaction,
    forUpdate,
  };
}

describe('production repository master data edit senkronizasyonu', () => {
  it('kilitlenen eski altı alanı yeni değerlerle birlikte aynı transactionda aktarır', async () => {
    const harness = createSuccessfulUpdateHarness();
    const syncMasterData = vi.fn(async () => undefined);
    const repository = createRepository(harness.database, syncMasterData);

    const result = await repository.updateWithAssignees(
      WORK_ITEM_ID,
      MASTER_DATA_UPDATE_INPUT,
      CREATOR_ID,
    );

    expect(result.status).toBe('updated');
    expect(harness.forUpdate).toHaveBeenCalledWith('update');
    expect(syncMasterData).toHaveBeenCalledTimes(1);
    expect(syncMasterData).toHaveBeenCalledWith(
      harness.transactionClient,
      {
        companyName: MASTER_DATA_UPDATE_INPUT.companyName,
        productName: MASTER_DATA_UPDATE_INPUT.productName,
        packagingType: MASTER_DATA_UPDATE_INPUT.packagingType,
        supplierCompany: MASTER_DATA_UPDATE_INPUT.supplierCompany,
        orderType: MASTER_DATA_UPDATE_INPUT.orderType,
        processStage: MASTER_DATA_UPDATE_INPUT.processStage,
      },
      PREVIOUS_MASTER_DATA_VALUES,
    );
  });

  it('değişmeyen normalize değerlerin şişirilmemesi için aynı eski snapshotı helpera verir', async () => {
    const unchangedInput: NormalizedUpdateWorkItemInput = {
      ...MASTER_DATA_UPDATE_INPUT,
      companyName: 'Aynı Firma',
      productName: 'Aynı Ürün',
      packagingType: null,
      supplierCompany: null,
      orderType: null,
      processStage: null,
    };
    const unchangedValues = {
      companyName: unchangedInput.companyName,
      productName: unchangedInput.productName,
      packagingType: unchangedInput.packagingType,
      supplierCompany: unchangedInput.supplierCompany,
      orderType: unchangedInput.orderType,
      processStage: unchangedInput.processStage,
    };
    const harness = createSuccessfulUpdateHarness(unchangedValues);
    const syncMasterData = vi.fn(async () => undefined);
    const repository = createRepository(harness.database, syncMasterData);

    await repository.updateWithAssignees(
      WORK_ITEM_ID,
      unchangedInput,
      CREATOR_ID,
    );

    expect(syncMasterData).toHaveBeenCalledWith(
      harness.transactionClient,
      unchangedValues,
      unchangedValues,
    );
  });

  it('master data senkronizasyonu başarısızsa alan ve atama değişikliklerini rollback eder', async () => {
    let selectSequence = 0;
    let rollbackCount = 0;
    const stagedOperations: string[] = [];
    const committedOperations: string[] = [];
    const forUpdate = vi.fn(async () => [
      {
        id: WORK_ITEM_ID,
        status: 'active',
        ...PREVIOUS_MASTER_DATA_VALUES,
      },
    ]);
    const select = vi.fn(() => {
      selectSequence += 1;

      if (selectSequence === 1) {
        return {
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(() => ({ for: forUpdate })),
            })),
          })),
        };
      }

      return {
        from: vi.fn(() => ({
          where: vi.fn(async () => [{ id: ASSIGNEE_ID }]),
        })),
      };
    });
    const update = vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => {
          stagedOperations.push('work-item-update');
        }),
      })),
    }));
    const deleteQuery = vi.fn(() => ({
      where: vi.fn(async () => {
        stagedOperations.push('assignee-delete');
      }),
    }));
    const insert = vi.fn(() => ({
      values: vi.fn(async () => {
        stagedOperations.push('assignee-insert');
      }),
    }));
    const transactionClient = { select, update, delete: deleteQuery, insert };
    const transaction = vi.fn(
      async (
        callback: (client: typeof transactionClient) => Promise<unknown>,
      ) => {
        try {
          const result = await callback(transactionClient);
          committedOperations.push(...stagedOperations);
          return result;
        } catch (error: unknown) {
          stagedOperations.length = 0;
          rollbackCount += 1;
          throw error;
        }
      },
    );
    const syncMasterData = vi.fn(async () => {
      throw new Error('Test master data edit sync hatası.');
    });
    const repository = createRepository({ transaction }, syncMasterData);

    await expect(
      repository.updateWithAssignees(
        WORK_ITEM_ID,
        UPDATE_INPUT,
        CREATOR_ID,
      ),
    ).rejects.toThrow('Test master data edit sync hatası.');

    expect(syncMasterData).toHaveBeenCalledWith(
      transactionClient,
      expect.objectContaining({
        companyName: UPDATE_INPUT.companyName,
        productName: UPDATE_INPUT.productName,
      }),
      PREVIOUS_MASTER_DATA_VALUES,
    );
    expect(committedOperations).toEqual([]);
    expect(rollbackCount).toBe(1);
  });

  it.each([
    ['bulunamayan', []],
    [
      'tamamlanmış',
      [
        {
          id: WORK_ITEM_ID,
          status: 'completed',
          ...PREVIOUS_MASTER_DATA_VALUES,
        },
      ],
    ],
  ])('%s iş için master data senkronizasyonu başlatmaz', async (_name, rows) => {
    const forUpdate = vi.fn(async () => rows);
    const select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => ({ for: forUpdate })),
        })),
      })),
    }));
    const transactionClient = { select };
    const transaction = vi.fn(
      async (
        callback: (client: typeof transactionClient) => Promise<unknown>,
      ) => callback(transactionClient),
    );
    const syncMasterData = vi.fn(async () => undefined);
    const repository = createRepository({ transaction }, syncMasterData);

    await repository.updateWithAssignees(
      WORK_ITEM_ID,
      MASTER_DATA_UPDATE_INPUT,
      CREATOR_ID,
    );

    expect(syncMasterData).not.toHaveBeenCalled();
  });

  it('geçersiz atamada update ve master data senkronizasyonu yapmaz', async () => {
    let selectSequence = 0;
    const forUpdate = vi.fn(async () => [
      {
        id: WORK_ITEM_ID,
        status: 'active',
        ...PREVIOUS_MASTER_DATA_VALUES,
      },
    ]);
    const select = vi.fn(() => {
      selectSequence += 1;

      if (selectSequence === 1) {
        return {
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(() => ({ for: forUpdate })),
            })),
          })),
        };
      }

      return {
        from: vi.fn(() => ({ where: vi.fn(async () => []) })),
      };
    });
    const update = vi.fn();
    const transactionClient = { select, update };
    const transaction = vi.fn(
      async (
        callback: (client: typeof transactionClient) => Promise<unknown>,
      ) => callback(transactionClient),
    );
    const syncMasterData = vi.fn(async () => undefined);
    const repository = createRepository({ transaction }, syncMasterData);

    const result = await repository.updateWithAssignees(
      WORK_ITEM_ID,
      UPDATE_INPUT,
      CREATOR_ID,
    );

    expect(result).toEqual({ status: 'invalid-assignees' });
    expect(update).not.toHaveBeenCalled();
    expect(syncMasterData).not.toHaveBeenCalled();
  });
});

describe('production repository iş düzenleme transaction sınırı', () => {
  it('atama inserti başarısızsa alan ve atama değişikliklerini rollback eder', async () => {
    let selectSequence = 0;
    let commitCount = 0;
    let rollbackCount = 0;
    const stagedOperations: unknown[] = [];
    const committedOperations: unknown[] = [];
    const forUpdate = vi.fn(async () => [
      { id: WORK_ITEM_ID, status: 'active' },
    ]);
    const select = vi.fn(() => {
      selectSequence += 1;

      if (selectSequence === 1) {
        return {
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(() => ({ for: forUpdate })),
            })),
          })),
        };
      }

      return {
        from: vi.fn(() => ({
          where: vi.fn(async () => [{ id: ASSIGNEE_ID }]),
        })),
      };
    });
    const updateWhere = vi.fn(async () => undefined);
    const updateSet = vi.fn((values: unknown) => {
      stagedOperations.push({ type: 'update', values });
      return { where: updateWhere };
    });
    const update = vi.fn(() => ({ set: updateSet }));
    const deleteWhere = vi.fn(async () => {
      stagedOperations.push({ type: 'delete-assignments' });
    });
    const deleteQuery = vi.fn(() => ({ where: deleteWhere }));
    const insertValues = vi.fn(async () => {
      stagedOperations.push({ type: 'insert-assignments' });
      throw new Error('Test atama insert hatası.');
    });
    const insert = vi.fn(() => ({ values: insertValues }));
    const transactionClient = {
      select,
      update,
      delete: deleteQuery,
      insert,
    };
    const transaction = vi.fn(
      async (
        callback: (client: typeof transactionClient) => Promise<unknown>,
      ) => {
        try {
          const result = await callback(transactionClient);
          committedOperations.push(...stagedOperations);
          commitCount += 1;
          return result;
        } catch (error: unknown) {
          stagedOperations.length = 0;
          rollbackCount += 1;
          throw error;
        }
      },
    );
    const repository = createRepository({ transaction });

    await expect(
      repository.updateWithAssignees(
        WORK_ITEM_ID,
        UPDATE_INPUT,
        CREATOR_ID,
      ),
    ).rejects.toThrow('Test atama insert hatası.');

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(forUpdate).toHaveBeenCalledWith('update');
    expect(update).toHaveBeenCalledWith(workItems);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        companyName: 'Güncel Firma',
        productName: 'Güncel Ürün',
        updatedAt: expect.any(Date),
      }),
    );
    expect(deleteQuery).toHaveBeenCalledWith(workItemAssignees);
    expect(insert).toHaveBeenCalledWith(workItemAssignees);
    expect(commitCount).toBe(0);
    expect(rollbackCount).toBe(1);
    expect(committedOperations).toEqual([]);
  });
});

describe('production repository soft delete sınırı', () => {
  it('işi fiziksel silmeden deletion alanlarını atomik olarak yazar', async () => {
    const forUpdate = vi.fn(async () => [
      { id: WORK_ITEM_ID, status: 'active' },
    ]);
    const select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => ({ for: forUpdate })),
        })),
      })),
    }));
    const updateWhere = vi.fn(async () => undefined);
    const updateSet = vi.fn((values: unknown) => {
      void values;
      return { where: updateWhere };
    });
    const update = vi.fn(() => ({ set: updateSet }));
    const deleteQuery = vi.fn();
    const transactionClient = { select, update, delete: deleteQuery };
    const transaction = vi.fn(
      async (
        callback: (client: typeof transactionClient) => Promise<unknown>,
      ) => callback(transactionClient),
    );
    const syncMasterData = vi.fn(async () => undefined);
    const repository = createRepository({ transaction }, syncMasterData);

    const result = await repository.softDelete(WORK_ITEM_ID, CREATOR_ID);

    expect(result).toEqual({ status: 'deleted' });
    expect(forUpdate).toHaveBeenCalledWith('update');
    expect(update).toHaveBeenCalledWith(workItems);
    expect(updateSet).toHaveBeenCalledWith({
      deletedAt: expect.any(Date),
      deletedBy: CREATOR_ID,
      updatedAt: expect.any(Date),
    });
    const values = updateSet.mock.calls[0]?.[0] as {
      deletedAt: Date;
      updatedAt: Date;
    };
    expect(values.updatedAt).toBe(values.deletedAt);
    expect(deleteQuery).not.toHaveBeenCalled();
    expect(syncMasterData).not.toHaveBeenCalled();
  });
});
