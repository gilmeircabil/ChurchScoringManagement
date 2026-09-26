export async function openDatabaseAsync(_dbName: string) {
  return {
    execAsync: async () => {},
    runAsync: async () => ({ lastInsertRowId: 1, changes: 1 }),
    getAllAsync: async () => [],
    getFirstAsync: async () => null,
    withTransactionAsync: async (task: any) => await task(),
  };
}
