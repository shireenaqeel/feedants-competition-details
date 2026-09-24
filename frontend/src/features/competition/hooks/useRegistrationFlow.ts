import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { endpoints } from '@/api/endpoints';
import { queryKeys } from '@/api/queryClient';
import type { PaymentOrder, Registration } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/i18n/LanguageProvider';
import { errorMessage } from '../errors';

export interface PendingPayment {
  registration: Registration;
  order: PaymentOrder;
}

/**
 * Register → (hold spot + payment order) → checkout → verify.
 * The server makes every call idempotent, so retries and double taps are safe.
 */
export function useRegistrationFlow(slug: string, competitionId: string | undefined) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [pending, setPending] = useState<PendingPayment | null>(null);

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.competitionAll(slug) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.availability(slug) }),
    ]);

  const fail = (error: unknown) => {
    Alert.alert(t('somethingWrong'), errorMessage(error, t));
    void refresh();
  };

  /** Creates (or resumes) the registration and opens checkout. */
  const start = useMutation({
    mutationFn: () => endpoints.register(competitionId!),
    onSuccess: async ({ registration, payment }) => {
      if (registration.status === 'pending_payment' && payment) setPending({ registration, order: payment });
      await refresh();
    },
    onError: fail,
  });

  const pay = useMutation({
    mutationFn: async (p: PendingPayment) => {
      if (p.order.provider !== 'mock') throw new Error(t('paymentUnavailable'));
      // Stand-in for the Razorpay checkout sheet: returns a signed payment like the real SDK.
      const signed = await endpoints.mockCheckout(p.order.orderId);
      return endpoints.verifyPayment(p.registration.id, signed);
    },
    onSuccess: async ({ registration }) => {
      setPending(null);
      await refresh();
      if (registration.status === 'confirmed') Alert.alert(t('paymentSuccess'), t('paymentSuccessBody'));
      else Alert.alert(t('paymentRefund'), t('paymentRefundBody'));
    },
    onError: fail,
  });

  const cancel = useMutation({
    mutationFn: (p: PendingPayment) => endpoints.cancelRegistration(p.registration.id),
    onSettled: async () => {
      setPending(null);
      await refresh();
    },
  });

  const register = () => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (competitionId) start.mutate();
  };

  return {
    register,
    resumePayment: register, // POST is idempotent: returns the existing hold and its order
    pending,
    closeCheckout: () => setPending(null),
    pay: () => pending && pay.mutate(pending),
    cancel: () => pending && cancel.mutate(pending),
    busy: start.isPending || pay.isPending || cancel.isPending,
    paying: pay.isPending,
    refresh,
  };
}
