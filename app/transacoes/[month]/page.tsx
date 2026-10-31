import { notFound } from 'next/navigation';

import { MonthDetail } from '@/components/MonthDetail';
import { bankParam } from '@/lib/bank-filter';
import { isMonthKey } from '@/lib/transaction-months';

export default async function MonthPage({
  params,
  searchParams,
}: {
  params: Promise<{ month: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { month } = await params;
  if (!isMonthKey(month)) notFound();
  const { banco } = await searchParams;
  return <MonthDetail monthKey={month} initialBank={bankParam(banco)} />;
}
