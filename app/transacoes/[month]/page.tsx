import { notFound } from 'next/navigation';

import { MonthDetail } from '@/components/MonthDetail';
import { isMonthKey } from '@/lib/transaction-months';

export default async function MonthPage({ params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;
  if (!isMonthKey(month)) notFound();
  return <MonthDetail monthKey={month} />;
}
