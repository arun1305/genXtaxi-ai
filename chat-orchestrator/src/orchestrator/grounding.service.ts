import { Injectable } from '@nestjs/common';
import { ScannedMoney } from '../tools/money-scan';

export interface GroundingResult {
  grounded: boolean;
  offendingAmounts: string[];
}

/**
 * Post-generation grounding check (spec §2.4): the reply may only contain
 * currency amounts that originate from a tool result. If it names an amount not
 * present in any tool result, the caller blocks + regenerates.
 *
 * We match numbers that appear alongside a currency code/symbol and confirm each
 * is present (in major or minor units) among the allowed tool-sourced amounts.
 */
@Injectable()
export class GroundingService {
  private static readonly CURRENCY_NUMBER =
    /(?:DZD|EUR|USD|XOF|MAD|TND|NGN|DA|CFA|DH|DT|€|\$|₦)\s*([\d.,]+)|([\d.,]+)\s*(?:DZD|EUR|USD|XOF|MAD|TND|NGN|DA|CFA|DH|DT|€|\$|₦)/gi;

  check(reply: string, allowed: ScannedMoney[]): GroundingResult {
    const allowedNums = new Set<number>();
    for (const m of allowed) {
      allowedNums.add(m.amount); // minor units
      allowedNums.add(m.amount / 100); // major (exp 2)
      allowedNums.add(m.amount / 1000); // major (exp 3, e.g. TND)
      allowedNums.add(Math.round(m.amount / 100));
    }

    const offending: string[] = [];
    for (const match of reply.matchAll(GroundingService.CURRENCY_NUMBER)) {
      const raw = (match[1] ?? match[2] ?? '').replace(/[,\s]/g, '');
      if (!raw) continue;
      const value = Number(raw);
      if (Number.isNaN(value)) continue;
      const ok = [...allowedNums].some((a) => Math.abs(a - value) < 0.01);
      if (!ok) offending.push(match[0].trim());
    }
    return { grounded: offending.length === 0, offendingAmounts: offending };
  }
}
