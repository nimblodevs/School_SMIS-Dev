import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage();

export const tenantContext = {
    run(context, callback) {
        return storage.run(context, callback);
    },
    get() {
        return storage.getStore() || null;
    },
};
