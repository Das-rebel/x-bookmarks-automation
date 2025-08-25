const { expect } = require('chai');
const sinon = require('sinon');
const { RetryFramework } = require('../retry-framework');

describe('RetryFramework', () => {
  let clock;
  let retry;
  
  beforeEach(() => {
    // Use fake timers for testing timeouts
    clock = sinon.useFakeTimers({
      now: Date.now(),
      shouldAdvanceTime: true
    });
    
    // Create a new instance for each test
    retry = new RetryFramework({
      maxRetries: 3,
      initialDelay: 100,
      maxDelay: 1000,
      circuitBreakerThreshold: 2,
      resetTimeout: 1000
    });
  });
  
  afterEach(() => {
    // Restore real timers
    clock.restore();
  });

  describe('exponential backoff', () => {
    it('should retry with increasing delays', async () => {
      const failingFn = sinon.stub();
      failingFn.onCall(0).rejects(new Error('First try'));
      failingFn.onCall(1).rejects(new Error('Second try'));
      failingFn.onCall(2).resolves('Success');
      
      const promise = retry.execute(failingFn);
      
      // First attempt fails immediately
      await clock.tickAsync(0);
      expect(failingFn.callCount).to.equal(1);
      
      // First retry after initial delay (100ms)
      await clock.tickAsync(100);
      expect(failingFn.callCount).to.equal(2);
      
      // Second retry after exponential backoff (200ms)
      await clock.tickAsync(200);
      expect(failingFn.callCount).to.equal(3);
      
      // Should resolve successfully
      await expect(promise).to.eventually.equal('Success');
    });
    
    it('should respect max delay', () => {
      const retry = new RetryFramework({
        initialDelay: 100,
        maxDelay: 200,
        factor: 10 // Force delay to exceed max
      });
      
      // First delay should be 100ms
      expect(retry.calculateDelay(1)).to.be.within(80, 120);
      
      // Second delay should be capped at maxDelay (200ms)
      expect(retry.calculateDelay(2)).to.be.within(160, 200);
    });
  });
  
  describe('circuit breaker', () => {
    it('should open circuit after threshold failures', async () => {
      const failingFn = sinon.stub().rejects(new Error('Service down'));
      
      // First failure
      await expect(retry.execute(failingFn)).to.be.rejected;
      expect(retry.circuitState).to.equal('CLOSED');
      
      // Second failure (reaches threshold)
      await expect(retry.execute(failingFn)).to.be.rejected;
      expect(retry.circuitState).to.equal('OPEN');
      
      // Third attempt should be blocked by circuit breaker
      await expect(retry.execute(failingFn)).to.be.rejectedWith('Service unavailable');
    });
    
    it('should reset circuit after timeout', async () => {
      const failingFn = sinon.stub().rejects(new Error('Service down'));
      
      // Open the circuit
      await expect(retry.execute(failingFn));
      await expect(retry.execute(failingFn));
      expect(retry.circuitState).to.equal('OPEN');
      
      // Fast-forward past reset timeout
      await clock.tickAsync(1001);
      
      // Next attempt should be allowed (circuit is HALF-OPEN)
      expect(retry.circuitState).to.equal('HALF-OPEN');
      
      // If success, circuit should close
      const successFn = sinon.stub().resolves('Working again');
      await expect(retry.execute(successFn)).to.eventually.equal('Working again');
      expect(retry.circuitState).to.equal('CLOSED');
    });
  });
  
  describe('retry strategies', () => {
    it('should not retry non-retriable errors', async () => {
      const nonRetriableError = new Error('Bad Request');
      nonRetriableError.statusCode = 400; // 4xx errors are non-retriable by default
      
      const failingFn = sinon.stub().rejects(nonRetriableError);
      
      await expect(retry.execute(failingFn)).to.be.rejectedWith('Bad Request');
      expect(failingFn.callCount).to.equal(1); // No retries
    });
    
    it('should use custom retry logic', async () => {
      const customRetry = new RetryFramework({
        shouldNotRetry: (error) => error.message.includes('Permanent')
      });
      
      const failingFn = sinon.stub()
        .onFirstCall().rejects(new Error('Temporary failure'))
        .onSecondCall().rejects(new Error('Permanent failure'));
      
      await expect(customRetry.execute(failingFn, { maxRetries: 2 }))
        .to.be.rejectedWith('Permanent failure');
      
      expect(failingFn.callCount).to.equal(2); // Should retry once
    });
  });
  
  describe('context passing', () => {
    it('should pass context to the function', async () => {
      const contextFn = sinon.stub().callsFake(({ attempt }) => {
        if (attempt < 2) throw new Error('Try again');
        return 'Success';
      });
      
      await expect(retry.execute(contextFn)).to.eventually.equal('Success');
      expect(contextFn.callCount).to.equal(2);
    });
  });
});
