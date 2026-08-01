import { Router } from 'express';
import { donations, loans, savingsTransactions, savingsGoals, loanPayments } from '../config/db.js';
import { ObjectId } from 'mongodb';
import { notifyUser } from '../utils/notifyHelpers.js';
import crypto from 'crypto';

const router = Router();

router.post('/webhooks/paymongo', async (req, res) => {
  try {
    const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
    const signatureHeader = req.headers['paymongo-signature'];

    if (webhookSecret) {
      if (!signatureHeader) {
        console.warn('[PayMongo Webhook] Missing paymongo-signature header');
        return res.status(400).send('Missing webhook signature');
      }

      // Verify PayMongo HMAC signature if secret is provided
      try {
        const parts = signatureHeader.split(',').reduce((acc, part) => {
          const [key, value] = part.split('=');
          if (key && value) acc[key.trim()] = value.trim();
          return acc;
        }, {});

        const timestamp = parts['t'];
        const signature = parts['te'] || parts['li'];
        const payload = `${timestamp}.${JSON.stringify(req.body)}`;
        const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');

        if (signature !== expectedSignature) {
          console.error('[PayMongo Webhook] Invalid signature verification');
          return res.status(401).send('Invalid webhook signature');
        }
      } catch (sigErr) {
        console.error('[PayMongo Webhook] Signature verification failed:', sigErr);
        return res.status(400).send('Webhook signature error');
      }
    } else {
      console.warn('[PayMongo Webhook] Warning: PAYMONGO_WEBHOOK_SECRET is not set in env. Signature check skipped for testing.');
    }

    const event = req.body;

    console.log('[PayMongo Webhook] Received Event:', event?.data?.attributes?.type);

    // Event Types from PayMongo:
    // checkout_session.payment.paid -> For Checkout Sessions (Donations, Savings Deposit, Loan Repayments)
    // disbursement.paid -> For Disbursements (Savings Withdrawal, Loan Disbursement)

    if (event.data.attributes.type === 'checkout_session.payment.paid') {
      // For checkout sessions, the ID of the checkout session is in event.data.attributes.data.id
      const checkoutSessionId = event.data.attributes.data.id;
      
      // We will identify the transaction by searching our DBs for this checkoutSessionId (stored as paymongoLinkId)
      
      // 1. Try Donations
      const donation = await donations.findOne({ paymongoLinkId: checkoutSessionId });
      if (donation) {
        if (donation.status === 'confirmed') {
          return res.status(200).send('Already processed');
        }
        await donations.updateOne(
          { _id: donation._id },
          { $set: { status: 'confirmed', confirmedAt: new Date() } }
        );
        console.log(`[Webhook] Confirmed donation ${donation.donationId}`);
        
        await notifyUser(
          donation.email,
          'donation',
          'Donation Confirmed',
          `<h2>Donation Received</h2><p>Thank you for your generous donation of ₱${donation.amount.toLocaleString()}.</p>`,
          `Your donation of ₱${donation.amount.toLocaleString()} was successful.`
        );

        return res.status(200).send('OK');
      }

      // 2. Try Savings Deposits
      const savingsTxn = await savingsTransactions.findOne({ paymongoLinkId: checkoutSessionId });
      if (savingsTxn) {
        if (savingsTxn.status === 'confirmed') {
          return res.status(200).send('Already processed');
        }
        // Update Transaction
        await savingsTransactions.updateOne(
          { _id: savingsTxn._id },
          { $set: { status: 'confirmed', confirmedAt: new Date(), confirmedBy: 'System (PayMongo)' } }
        );

        // Update Goal
        const goal = await savingsGoals.findOne({ _id: savingsTxn.goalId });
        if (goal) {
          const newSaved = (goal.savedAmount || 0) + savingsTxn.amount;
          const updates = { savedAmount: newSaved, updatedAt: new Date() };
          if (newSaved >= goal.targetAmount) updates.status = 'completed';
          await savingsGoals.updateOne({ _id: savingsTxn.goalId }, { $set: updates });
        }
        
        console.log(`[Webhook] Confirmed savings deposit to ${savingsTxn.goalName}`);
        
        await notifyUser(
          savingsTxn.email,
          'savings',
          'Savings Deposit Confirmed',
          `<h2>Deposit Successful</h2><p>Your deposit of ₱${savingsTxn.amount.toLocaleString()} to "${savingsTxn.goalName || 'Savings'}" has been confirmed.</p>`,
          `Deposit of ₱${savingsTxn.amount.toLocaleString()} confirmed.`
        );

        return res.status(200).send('OK');
      }

      // 3. Try Loan Payments
      const loanPayment = await loanPayments.findOne({ paymongoLinkId: checkoutSessionId });
      if (loanPayment) {
        if (loanPayment.status === 'confirmed') {
          return res.status(200).send('Already processed');
        }
        // 1. Mark payment as confirmed
        await loanPayments.updateOne(
          { _id: loanPayment._id },
          { $set: { status: 'confirmed', confirmedAt: new Date() } }
        );

        // 2. Apply to loan
        const loan = await loans.findOne({ _id: loanPayment.loanObjectId });
        if (loan) {
          const newPaidMonths = (loan.paidMonths || 0) + 1;
          const paymentAmount = loanPayment.amount || loan.monthlyPayment || 0;
          const newBalance = Math.max(0, (loan.remainingBalance || loan.totalRepayment || loan.amount) - paymentAmount);
          const isComplete = newPaidMonths >= (loan.termMonths || 12);

          const startDate = new Date(loan.disbursementDate || loan.approvedDate || loan.appliedDate);
          const nextDue = new Date(startDate);
          nextDue.setMonth(startDate.getMonth() + newPaidMonths + 1);

          await loans.updateOne(
            { _id: loanPayment.loanObjectId },
            {
              $set: {
                paidMonths: newPaidMonths,
                remainingBalance: newBalance,
                status: isComplete ? 'completed' : 'active',
                nextDueDate: isComplete ? null : nextDue,
                updatedAt: new Date(),
              },
              $push: {
                statusHistory: {
                  status: 'payment_confirmed',
                  date: new Date(),
                  monthNumber: newPaidMonths,
                  amount: paymentAmount,
                  paymentMethod: loanPayment.paymentMethod || 'cash',
                  confirmedBy: 'System (PayMongo)'
                }
              }
            }
          );
          console.log(`[Webhook] Confirmed loan payment for ${loan.loanId}`);
          
          await notifyUser(
            loan.email,
            'loan',
            'Loan Payment Confirmed',
            `<h2>Payment Confirmed</h2><p>Your payment of ₱${paymentAmount.toLocaleString()} via PayMongo has been confirmed. Remaining balance: ₱${newBalance.toLocaleString()}.</p>`,
            `Payment of ₱${paymentAmount.toLocaleString()} confirmed. Remaining balance: ₱${newBalance.toLocaleString()}.`
          );
        } else {
          console.log(`[Webhook] Warning: Loan not found for payment ${loanPayment._id}`);
        }
        return res.status(200).send('OK');
      }
    } else if (event.data.attributes.type === 'disbursement.paid') {
        // TODO: Handle Disbursement Success (Withdrawals & Loan Disbursements)
    }

    res.status(200).send('Event received');
  } catch (err) {
    console.error('[Webhook Error]', err);
    res.status(500).send('Webhook error');
  }
});

export default router;
