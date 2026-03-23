import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

interface RateLimiterOptions {
  maxRequests: number;
  windowMs: number;
  showToast?: boolean;
}

interface RateLimiterState {
  requestTimestamps: number[];
}

export function useRateLimiter(options: RateLimiterOptions = { maxRequests: 5, windowMs: 60000, showToast: true }) {
  const { maxRequests, windowMs, showToast = true } = options;
  const { toast } = useToast();
  const stateRef = useRef<RateLimiterState>({ requestTimestamps: [] });
  const [isRateLimited, setIsRateLimited] = useState(false);

  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();
    const state = stateRef.current;
    
    // Remove timestamps outside the window
    state.requestTimestamps = state.requestTimestamps.filter(
      timestamp => now - timestamp < windowMs
    );

    // Check if we've exceeded the limit
    if (state.requestTimestamps.length >= maxRequests) {
      setIsRateLimited(true);
      
      // Calculate time until next available request
      const oldestTimestamp = state.requestTimestamps[0];
      const timeUntilReset = Math.ceil((oldestTimestamp + windowMs - now) / 1000);
      
      if (showToast) {
        toast({
          title: 'Rate limit reached',
          description: `Please wait ${timeUntilReset} seconds before making another request.`,
          variant: 'destructive',
        });
      }
      
      return false;
    }

    return true;
  }, [maxRequests, windowMs, showToast, toast]);

  const recordRequest = useCallback(() => {
    stateRef.current.requestTimestamps.push(Date.now());
    setIsRateLimited(false);
  }, []);

  const executeWithRateLimit = useCallback(async <T>(
    fn: () => Promise<T>
  ): Promise<T | null> => {
    if (!checkRateLimit()) {
      return null;
    }
    
    recordRequest();
    return fn();
  }, [checkRateLimit, recordRequest]);

  const getRemainingRequests = useCallback((): number => {
    const now = Date.now();
    const state = stateRef.current;
    
    // Remove timestamps outside the window
    state.requestTimestamps = state.requestTimestamps.filter(
      timestamp => now - timestamp < windowMs
    );
    
    return Math.max(0, maxRequests - state.requestTimestamps.length);
  }, [maxRequests, windowMs]);

  const getTimeUntilReset = useCallback((): number => {
    const now = Date.now();
    const state = stateRef.current;
    
    if (state.requestTimestamps.length === 0) {
      return 0;
    }
    
    const oldestTimestamp = state.requestTimestamps[0];
    const timeUntilReset = Math.max(0, oldestTimestamp + windowMs - now);
    
    return Math.ceil(timeUntilReset / 1000);
  }, [windowMs]);

  return {
    isRateLimited,
    checkRateLimit,
    recordRequest,
    executeWithRateLimit,
    getRemainingRequests,
    getTimeUntilReset,
  };
}

// Singleton rate limiter for AI image generation (shared across components)
const aiImageRateLimiter = {
  requestTimestamps: [] as number[],
  maxRequests: 10,
  windowMs: 60000, // 1 minute
};

export function checkAIImageRateLimit(): { allowed: boolean; waitTime: number } {
  const now = Date.now();
  
  // Remove timestamps outside the window
  aiImageRateLimiter.requestTimestamps = aiImageRateLimiter.requestTimestamps.filter(
    timestamp => now - timestamp < aiImageRateLimiter.windowMs
  );

  // Check if we've exceeded the limit
  if (aiImageRateLimiter.requestTimestamps.length >= aiImageRateLimiter.maxRequests) {
    const oldestTimestamp = aiImageRateLimiter.requestTimestamps[0];
    const waitTime = Math.ceil((oldestTimestamp + aiImageRateLimiter.windowMs - now) / 1000);
    return { allowed: false, waitTime };
  }

  return { allowed: true, waitTime: 0 };
}

export function recordAIImageRequest(): void {
  aiImageRateLimiter.requestTimestamps.push(Date.now());
}

// Singleton rate limiter for AI text generation
const aiTextRateLimiter = {
  requestTimestamps: [] as number[],
  maxRequests: 15,
  windowMs: 60000, // 1 minute
};

export function checkAITextRateLimit(): { allowed: boolean; waitTime: number } {
  const now = Date.now();
  
  // Remove timestamps outside the window
  aiTextRateLimiter.requestTimestamps = aiTextRateLimiter.requestTimestamps.filter(
    timestamp => now - timestamp < aiTextRateLimiter.windowMs
  );

  // Check if we've exceeded the limit
  if (aiTextRateLimiter.requestTimestamps.length >= aiTextRateLimiter.maxRequests) {
    const oldestTimestamp = aiTextRateLimiter.requestTimestamps[0];
    const waitTime = Math.ceil((oldestTimestamp + aiTextRateLimiter.windowMs - now) / 1000);
    return { allowed: false, waitTime };
  }

  return { allowed: true, waitTime: 0 };
}

export function recordAITextRequest(): void {
  aiTextRateLimiter.requestTimestamps.push(Date.now());
}
