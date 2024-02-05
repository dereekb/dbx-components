import { range } from '../array/array.number';
import { isEvenNumber, randomNumberFactory } from '../number';
import { performAsyncTasks, performTasksInParallel } from './promise';
import { waitForMs } from './wait';

describe('performAsyncTasks()', () => {
  it('should perform the given tasks', async () => {
    let tasksStarted = 0;

    const tasksToRun = 4;
    const input = range(0, tasksToRun);

    const result = await performAsyncTasks(input, (x) => {
      tasksStarted += 1;
      return waitForMs(2);
    });

    expect(result.results.length).toBe(tasksToRun);
    expect(result.succeded.length).toBe(tasksToRun);
    expect(result.failed.length).toBe(0);

    expect(tasksStarted).toBe(tasksToRun);
  });

  describe('nonConcurrentTaskKeyFactory', () => {
    it('should perform the given tasks with respect to non-concurrency', async () => {
      let tasksStarted = 0;

      const tasksToRun = 4;
      const input = range(0, tasksToRun);
      const nonConcurrentTaskKeyFactory = (x: number) => (isEvenNumber(x) ? 'even' : 'odd') as 'even' | 'odd';

      let wasRunningConcurrentTask = false;
      const currentTaskKeys = new Set<'even' | 'odd'>();

      const result = await performAsyncTasks(
        input,
        async (x) => {
          tasksStarted += 1;

          const key = nonConcurrentTaskKeyFactory(x);

          // check if already running or not
          if (currentTaskKeys.has(key)) {
            wasRunningConcurrentTask = true;
          } else {
            currentTaskKeys.add(key);
          }

          await waitForMs(2);

          currentTaskKeys.delete(key);
        },
        {
          nonConcurrentTaskKeyFactory
        }
      );

      expect(result.results.length).toBe(tasksToRun);
      expect(result.succeded.length).toBe(tasksToRun);
      expect(result.failed.length).toBe(0);
      expect(wasRunningConcurrentTask).toBe(false);

      expect(tasksStarted).toBe(tasksToRun);
    });
  });

  it('should throw the first caught error.', (done) => {
    let tasksStarted = 0;

    const tasksToRun = 6;
    const input = range(0, tasksToRun);
    const testError = new Error('test error');

    performAsyncTasks(input, (x) => {
      tasksStarted += 1;

      if (x === 3) {
        return waitForMs(10).then(() => {
          throw testError;
        });
      } else {
        return waitForMs(100);
      }
    }).catch((e) => {
      expect(tasksStarted).toBe(tasksToRun);
      expect(e).toBe(testError);
      done();
    });
  });

  describe('retriesAllowed>0', () => {
    it('should retry failed tasks.', async () => {
      let tasksStarted = 0;
      let encounteredFailure = false;

      const tasksToRun = 6;
      const input = range(0, tasksToRun);

      await performAsyncTasks(
        input,
        (x) => {
          tasksStarted += 1;

          if (x === 3) {
            // fail only once. After retry it will work.
            return waitForMs(50).then(() => {
              encounteredFailure = true;
              throw new Error('test error');
            });
          } else {
            return waitForMs(100);
          }
        },
        {
          throwError: false,
          retriesAllowed: 1
        }
      );

      expect(tasksStarted).toBe(tasksToRun + 1); // runs all queued tasksk
      expect(encounteredFailure).toBe(true);
    });
  });

  describe('throwError=false', () => {
    it('should not throw errors.', async () => {
      const tasksToRun = 8;
      const input = range(0, tasksToRun);
      const testError = new Error('test error');

      const result = await performAsyncTasks(
        input,
        (x) => {
          if (x === 3) {
            return waitForMs(10).then(() => {
              throw testError;
            });
          } else {
            return waitForMs(20).then(() => true);
          }
        },
        {
          throwError: false
        }
      );

      expect(result.succeded.length).toBe(tasksToRun - 1);
      expect(result.failed.length).toBe(1);
      expect(result.results.length).toBe(tasksToRun - 1);
      expect(result.errors.length).toBe(1);
    });
  });
});

describe('performTasksInParallelFunction()', () => {
  it('should perform all the tasks (sync)', (done) => {
    let tasksStarted = 0;

    const tasksToRun = 6;
    const maxParallel = 3;

    const input = range(0, tasksToRun);

    performTasksInParallel(input, {
      taskFactory: async () => {
        tasksStarted += 1;
      },
      maxParallelTasks: maxParallel
    }).then(() => {
      expect(tasksStarted).toBe(tasksToRun);
      done();
    });
  });

  it('should return if no items are present', (done) => {
    let tasksStarted = 0;

    const tasksToRun = 6;
    const maxParallel = 3;

    performTasksInParallel([], {
      taskFactory: async () => {
        tasksStarted += 1;
      },
      maxParallelTasks: maxParallel
    }).then(() => {
      expect(tasksStarted).toBe(0);
      done();
    });
  });

  it('should throw the first caught error.', (done) => {
    let tasksStarted = 0;

    const tasksToRun = 6;
    const input = range(0, tasksToRun);

    performTasksInParallel(input, {
      taskFactory: async () => {
        tasksStarted += 1;

        if (tasksStarted === 3) {
          return waitForMs(10).then(() => {
            throw new Error('test error');
          });
        } else {
          return waitForMs(200);
        }
      },
      maxParallelTasks: undefined
    }).catch((e) => {
      expect(tasksStarted).toBe(tasksToRun);
      done();
    });
  });

  describe('nonConcurrentTaskKeyFactory', () => {
    it('should prevent tasks with the same key from running concurrently.', (done) => {
      let tasksStarted = 0;

      const tasksToRun = 8;
      const input = range(0, tasksToRun);

      let wasRunningConcurrentTask = false;
      const currentTaskKeys = new Set<'even' | 'odd'>();

      performTasksInParallel(input, {
        maxParallelTasks: tasksToRun, // set to try to run then all in parallel
        nonConcurrentTaskKeyFactory: (x) => (isEvenNumber(x) ? 'even' : 'odd') as 'even' | 'odd', // based on if they're even or odd
        taskFactory: async (x, _, keys) => {
          const key = keys[0];

          tasksStarted += 1;

          // check if already running or not
          if (currentTaskKeys.has(key)) {
            wasRunningConcurrentTask = true;
          } else {
            currentTaskKeys.add(key);
          }

          await waitForMs(10);

          currentTaskKeys.delete(key);
        }
      }).then(() => {
        expect(tasksStarted).toBe(tasksToRun);
        expect(wasRunningConcurrentTask).toBe(false);
        done();
      });
    });

    it('should prevent tasks with the same key(s) from running concurrently.', (done) => {
      let tasksStarted = 0;

      const tasksToRun = 8;
      const input = range(0, tasksToRun);

      let wasRunningConcurrentTask = false;
      const currentTaskKeys = new Set<'even' | 'odd'>();

      performTasksInParallel(input, {
        maxParallelTasks: tasksToRun, // set to try to run then all in parallel
        nonConcurrentTaskKeyFactory: (x) => ['even', 'odd'], // each key will return 'even' and 'odd', so only one should be running at a time now
        taskFactory: async (x, _, keys) => {
          tasksStarted += 1;

          // check if already running or not
          keys.forEach((key) => {
            if (currentTaskKeys.has(key)) {
              wasRunningConcurrentTask = true;
            } else {
              currentTaskKeys.add(key);
            }
          });

          await waitForMs(10);

          keys.forEach((key) => currentTaskKeys.delete(key));
        }
      }).then(() => {
        expect(tasksStarted).toBe(tasksToRun);
        expect(wasRunningConcurrentTask).toBe(false);
        done();
      });
    });

    it('should prevent tasks with the some same keys, and repeat keys, from running again or concurrently.', (done) => {
      let tasksStarted = 0;

      const tasksToRun = 100;
      const input = range(0, tasksToRun);

      let wasRunningConcurrentTask = false;
      const randomNumber = randomNumberFactory(5, 'floor');
      const currentTaskKeys = new Set<0 | 1 | 2 | 3 | 4>();

      performTasksInParallel(input, {
        maxParallelTasks: tasksToRun, // set to try to run then all in parallel
        nonConcurrentTaskKeyFactory: (x) => {
          const a = randomNumber();
          return [a, randomNumber(), a] as unknown as (0 | 1 | 2 | 3 | 4)[];
        }, // each key will return 'even' and 'odd', so only one should be running at a time now
        taskFactory: async (x, _, keys) => {
          tasksStarted += 1;

          // check if already running or not
          const onlyUniqueKeys = new Set(keys);
          onlyUniqueKeys.forEach((key) => {
            if (currentTaskKeys.has(key)) {
              wasRunningConcurrentTask = true;
            } else {
              currentTaskKeys.add(key);
            }
          });

          await waitForMs(10);

          onlyUniqueKeys.forEach((key) => currentTaskKeys.delete(key));
        }
      }).then(() => {
        expect(tasksStarted).toBe(tasksToRun);
        expect(wasRunningConcurrentTask).toBe(false);
        done();
      });
    });
  });

  describe('waitBetweenTasks', () => {
    it('should wait the specific amount of time between tasks.', (done) => {
      let tasksStarted = 0;

      const tasksToRun = 2;
      const input = range(0, tasksToRun);
      let success = false;

      performTasksInParallel(input, {
        maxParallelTasks: 1, // sequential
        taskFactory: async () => {
          tasksStarted += 1;
          return waitForMs(50);
        },
        waitBetweenTasks: 50
      }).then(() => {
        expect(success).toBe(true);
        done();
      });

      waitForMs(50).then(() => {
        expect(tasksStarted).toBe(1); // should still be waiting for the next task
        success = true;
      });
    });
  });

  describe('sequential=true', () => {
    it('should set the maxParallel to 1', (done) => {
      let tasksStarted = 0;

      const tasksToRun = 6;
      const maxParallel = 1;

      const input = range(0, tasksToRun);

      let success = false;

      performTasksInParallel(input, {
        taskFactory: async () => {
          tasksStarted += 1;
          return waitForMs(100);
        },
        sequential: true,
        waitBetweenTasks: 50
      }).then(() => {
        expect(success).toBe(true);
        done();
      });

      waitForMs(50).then(() => {
        expect(tasksStarted).toBe(maxParallel); // should have started only one of the tasks
        success = true;
      });
    });
  });

  describe('maxParallel=', () => {
    describe('undefined', () => {
      it('should run all of the tasks in parallel at once.', (done) => {
        let tasksStarted = 0;

        const tasksToRun = 10;
        const input = range(0, tasksToRun);

        let success = false;

        performTasksInParallel(input, {
          taskFactory: async () => {
            tasksStarted += 1;
            return waitForMs(400);
          },
          maxParallelTasks: undefined
        }).then(() => {
          expect(success).toBe(true);
          done();
        });

        waitForMs(100).then(() => {
          expect(tasksStarted).toBe(tasksToRun); // should have started them all immediately
          success = true;
        });
      });
    });

    describe('3', () => {
      describe('with sequential=true', () => {
        it('should ignore the sequential flag', (done) => {
          let tasksStarted = 0;

          const tasksToRun = 6;
          const maxParallel = 3;

          const input = range(0, tasksToRun);

          let success = false;

          performTasksInParallel(input, {
            taskFactory: async () => {
              tasksStarted += 1;
              return waitForMs(100);
            },
            sequential: true,
            maxParallelTasks: maxParallel,
            waitBetweenTasks: 50
          }).then(() => {
            expect(success).toBe(true);
            done();
          });

          waitForMs(50).then(() => {
            expect(tasksStarted).toBe(maxParallel); // should have started only three of the tasks
            success = true;
          });
        });
      });

      it('should run 3 of the tasks in parallel at once.', (done) => {
        let tasksStarted = 0;

        const tasksToRun = 6;
        const maxParallel = 3;

        const input = range(0, tasksToRun);

        let success = false;

        performTasksInParallel(input, {
          taskFactory: async () => {
            tasksStarted += 1;
            return waitForMs(100);
          },
          maxParallelTasks: maxParallel,
          waitBetweenTasks: 50
        }).then(() => {
          expect(success).toBe(true);
          done();
        });

        waitForMs(50).then(() => {
          expect(tasksStarted).toBe(maxParallel); // should have started only three of the tasks
          success = true;
        });
      });

      it('should return once all the tasks are complete.', (done) => {
        let tasksStarted = 0;

        const tasksToRun = 6;
        const maxParallel = 3;

        const input = range(0, tasksToRun);

        performTasksInParallel(input, {
          taskFactory: async () => {
            tasksStarted += 1;
            return waitForMs(100);
          },
          maxParallelTasks: maxParallel
        }).then(() => {
          expect(tasksStarted).toBe(tasksToRun);
          done();
        });
      });
    });
  });
});
