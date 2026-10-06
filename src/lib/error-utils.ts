import { TranslationKey } from './i18n';

export type AppErrorCategory =
  | 'network'
  | 'server'
  | 'authentication'
  | 'payment'
  | 'subscription'
  | 'donation'
  | 'content_sync'
  | 'admin'
  | 'generic';

export type AppErrorContext =
  | 'auth'
  | 'payment'
  | 'subscription'
  | 'donation'
  | 'content'
  | 'admin'
  | 'generic';

export type ClassifiedAppError = {
  category: AppErrorCategory;
  titleKey: TranslationKey;
  messageKey: TranslationKey;
  isNetworkError: boolean;
  isRetryable: boolean;
};

/**
 * Robustly inspects an unknown exception or object to detect network/transport/connectivity failures.
 * Note: Returning true indicates a transport/network-like failure, which callers can combine with NetInfo.
 */
export function isNetworkLikeError(rawError: unknown): boolean {
  if (!rawError) return false;

  try {
    let msg = '';
    if (typeof rawError === 'string') {
      msg = rawError.toLowerCase();
    } else if (rawError instanceof Error) {
      msg = rawError.message.toLowerCase();
    } else if (typeof rawError === 'object' && rawError !== null) {
      const errObj = rawError as { message?: unknown; error?: unknown; details?: unknown };
      msg = String(errObj.message ?? errObj.error ?? errObj.details ?? '').toLowerCase();
    }

    return (
      msg.includes('network') ||
      msg.includes('fetch') ||
      msg.includes('failed to fetch') ||
      msg.includes('unknownhostexception') ||
      msg.includes('connectexception') ||
      msg.includes('sockettimeoutexception') ||
      msg.includes('timeout') ||
      msg.includes('timed out') ||
      msg.includes('connection refused') ||
      msg.includes('connection reset') ||
      msg.includes('netinfo')
    );
  } catch {
    return false;
  }
}

/**
 * Pure, deterministic classifier that converts raw technical errors into strongly-typed i18n keys and metadata.
 * Never exposes raw technical exception text to user-facing keys.
 * Never throws for any input.
 */
export function classifyAppError(
  error: unknown,
  context: AppErrorContext = 'generic'
): ClassifiedAppError {
  try {
    const isNetwork = isNetworkLikeError(error);

    // 1. High-priority Network/Transport Failures
    if (isNetwork) {
      return {
        category: 'network',
        titleKey: 'errOfflineTitle',
        messageKey: 'errOfflineMsg',
        isNetworkError: true,
        isRetryable: true,
      };
    }

    // 2. Domain-Specific Context Classification
    switch (context) {
      case 'payment':
        return {
          category: 'payment',
          titleKey: 'errPaymentFailedTitle',
          messageKey: 'errPaymentFailedMsg',
          isNetworkError: false,
          isRetryable: true,
        };

      case 'subscription':
        return {
          category: 'subscription',
          titleKey: 'errSubscriptionFailedTitle',
          messageKey: 'errSubscriptionFailedMsg',
          isNetworkError: false,
          isRetryable: true,
        };

      case 'donation':
        return {
          category: 'donation',
          titleKey: 'errDonationFailedTitle',
          messageKey: 'errDonationFailedMsg',
          isNetworkError: false,
          isRetryable: true,
        };

      case 'content':
        return {
          category: 'content_sync',
          titleKey: 'errContentSyncTitle',
          messageKey: 'errContentSyncMsg',
          isNetworkError: false,
          isRetryable: true,
        };

      case 'admin':
        return {
          category: 'admin',
          titleKey: 'errAdminOperationTitle',
          messageKey: 'errAdminOperationMsg',
          isNetworkError: false,
          isRetryable: true,
        };

      case 'auth':
        return {
          category: 'authentication',
          titleKey: 'errSessionExpiredTitle',
          messageKey: 'errSessionExpiredMsg',
          isNetworkError: false,
          isRetryable: false,
        };

      case 'generic':
      default:
        return {
          category: 'generic',
          titleKey: 'errGenericTitle',
          messageKey: 'errGenericMsg',
          isNetworkError: false,
          isRetryable: true,
        };
    }
  } catch {
    // Safe fallback for unexpected classification exceptions
    return {
      category: 'generic',
      titleKey: 'errGenericTitle',
      messageKey: 'errGenericMsg',
      isNetworkError: false,
      isRetryable: true,
    };
  }
}
