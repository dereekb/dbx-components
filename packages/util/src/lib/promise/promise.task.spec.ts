import { runNamedAsyncTasks, runNamedAsyncTasksFunction, type RunNamedAsyncTasksInput, type NamedAsyncTask } from './promise.task';

describe('runNamedAsyncTasksFunction()', () => {
  describe('function', () => {
    it('should create a reusable function that runs named async tasks from array', async () => {
      let task1Run = false;
      let task2Run = false;

      const runTasks = runNamedAsyncTasksFunction();

      const tasks: RunNamedAsyncTasksInput<void> = [
        {
          name: 'task1',
          run: async () => {
            task1Run = true;
          }
        },
        {
          name: 'task2',
          run: async () => {
            task2Run = true;
          }
        }
      ];

      const result = await runTasks(tasks);

      expect(result.successfulTasks.length).toBe(2);
      expect(result.failedTasks.length).toBe(0);
      expect(task1Run).toBe(true);
      expect(task2Run).toBe(true);
    });

    it('should run named async tasks from record', async () => {
      let task1Run = false;
      let task2Run = false;

      const runTasks = runNamedAsyncTasksFunction();

      const tasks: RunNamedAsyncTasksInput<void> = {
        task1: async () => {
          task1Run = true;
        },
        task2: async () => {
          task2Run = true;
        }
      };

      const result = await runTasks(tasks);

      expect(result.successfulTasks.length).toBe(2);
      expect(result.failedTasks.length).toBe(0);
      expect(task1Run).toBe(true);
      expect(task2Run).toBe(true);
    });

    it('should handle task failures', async () => {
      const runTasks = runNamedAsyncTasksFunction();

      const tasks: RunNamedAsyncTasksInput<void> = [
        {
          name: 'task1',
          run: async () => {
            throw new Error('Task 1 failed');
          }
        },
        {
          name: 'task2',
          run: async () => {
            // success
          }
        }
      ];

      const result = await runTasks(tasks);

      expect(result.successfulTasks.length).toBe(1);
      expect(result.failedTasks.length).toBe(1);
      expect(result.successfulTasks[0].name).toBe('task2');
      expect(result.failedTasks[0].name).toBe('task1');
    });

    it('should call onTaskSuccess callback for successful tasks', async () => {
      const successfulTasks: NamedAsyncTask<string>[] = [];
      const values: string[] = [];

      const runTasks = runNamedAsyncTasksFunction<string>({
        onTaskSuccess: (task, value) => {
          successfulTasks.push(task);
          values.push(value);
        }
      });

      const tasks: RunNamedAsyncTasksInput<string> = [
        {
          name: 'task1',
          run: async () => 'result1'
        },
        {
          name: 'task2',
          run: async () => 'result2'
        }
      ];

      await runTasks(tasks);

      expect(successfulTasks.length).toBe(2);
      expect(successfulTasks[0].name).toBe('task1');
      expect(successfulTasks[1].name).toBe('task2');
      expect(values).toEqual(['result1', 'result2']);
    });

    it('should call onTaskFailure callback for failed tasks', async () => {
      const failedTasks: NamedAsyncTask<void>[] = [];
      const errors: unknown[] = [];

      const runTasks = runNamedAsyncTasksFunction({
        onTaskFailure: (task, error) => {
          failedTasks.push(task);
          errors.push(error);
        }
      });

      const error1 = new Error('Task 1 failed');
      const error2 = new Error('Task 2 failed');

      const tasks: RunNamedAsyncTasksInput<void> = [
        {
          name: 'task1',
          run: async () => {
            throw error1;
          }
        },
        {
          name: 'task2',
          run: async () => {
            throw error2;
          }
        }
      ];

      await runTasks(tasks);

      expect(failedTasks.length).toBe(2);
      expect(failedTasks[0].name).toBe('task1');
      expect(failedTasks[1].name).toBe('task2');
      expect(errors).toEqual([error1, error2]);
    });

    it('should handle mixed success and failure with callbacks', async () => {
      const successfulTasks: string[] = [];
      const failedTasks: string[] = [];

      const runTasks = runNamedAsyncTasksFunction({
        onTaskSuccess: (task) => {
          successfulTasks.push(task.name);
        },
        onTaskFailure: (task) => {
          failedTasks.push(task.name);
        }
      });

      const tasks: RunNamedAsyncTasksInput<void> = [
        {
          name: 'task1',
          run: async () => {
            // success
          }
        },
        {
          name: 'task2',
          run: async () => {
            throw new Error('Failed');
          }
        },
        {
          name: 'task3',
          run: async () => {
            // success
          }
        }
      ];

      const result = await runTasks(tasks);

      expect(result.successfulTasks.length).toBe(2);
      expect(result.failedTasks.length).toBe(1);
      expect(successfulTasks).toEqual(['task1', 'task3']);
      expect(failedTasks).toEqual(['task2']);
    });

    it('should be reusable for multiple task runs', async () => {
      let runCount = 0;

      const runTasks = runNamedAsyncTasksFunction({
        onTaskSuccess: () => {
          runCount++;
        }
      });

      const tasks1: RunNamedAsyncTasksInput<void> = [{ name: 'task1', run: async () => {} }];

      const tasks2: RunNamedAsyncTasksInput<void> = [
        { name: 'task2', run: async () => {} },
        { name: 'task3', run: async () => {} }
      ];

      await runTasks(tasks1);
      expect(runCount).toBe(1);

      await runTasks(tasks2);
      expect(runCount).toBe(3);
    });
  });
});

describe('runNamedAsyncTasks()', () => {
  describe('function', () => {
    it('should run named async tasks', async () => {
      let task1Run = false;
      let task2Run = false;

      const tasks: RunNamedAsyncTasksInput<void> = [
        {
          name: 'task1',
          run: async () => {
            task1Run = true;
          }
        },
        {
          name: 'task2',
          run: async () => {
            task2Run = true;
          }
        }
      ];

      const result = await runNamedAsyncTasks(tasks);

      expect(result.successfulTasks.length).toBe(2);
      expect(result.failedTasks.length).toBe(0);

      expect(task1Run).toBe(true);
      expect(task2Run).toBe(true);
    });
  });
});
