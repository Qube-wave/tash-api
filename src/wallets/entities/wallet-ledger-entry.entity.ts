import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum LedgerDirection {
  Credit = 'credit',
  Debit = 'debit',
}

export enum WalletLedgerEntryType {
  CardFunding = 'card_funding',
  DirectDebitFunding = 'direct_debit_funding',
  VirtualAccountFunding = 'virtual_account_funding',
  TransferSent = 'transfer_sent',
  TransferReceived = 'transfer_received',
  MerchantPayment = 'merchant_payment',
  RefundReceived = 'refund_received',
  RefundDebit = 'refund_debit',
  Reversal = 'reversal',
  Adjustment = 'adjustment',
}

export enum WalletLedgerEntryStatus {
  Pending = 'pending',
  Completed = 'completed',
  Reversed = 'reversed',
}

@Entity({ name: 'wallet_ledger_entries' })
export class WalletLedgerEntry {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index({ unique: true })
  @Column({ type: 'uuid', generated: 'uuid' })
  uuid!: string;

  @Index()
  @Column({ type: 'integer' })
  walletId!: number;

  @Index()
  @Column({ type: 'integer' })
  transactionId!: number;

  @Index()
  @Column({ type: 'varchar', length: 80 })
  reference!: string;

  @Column({ type: 'enum', enum: LedgerDirection })
  direction!: LedgerDirection;

  @Column({ type: 'enum', enum: WalletLedgerEntryType })
  entryType!: WalletLedgerEntryType;

  @Column({ type: 'bigint' })
  amount!: string;

  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  @Column({ type: 'bigint' })
  balanceBefore!: string;

  @Column({ type: 'bigint' })
  balanceAfter!: string;

  @Column({ type: 'enum', enum: WalletLedgerEntryStatus })
  status!: WalletLedgerEntryStatus;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
