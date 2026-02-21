/**
 * Creates a minimal, valid, gzip-compressed GnuCash file from scratch.
 *
 * Generates a standard double-entry account structure:
 *   Assets > Checking Account, Savings Account
 *   Liabilities > Credit Card
 *   Income > Salary, Other Income
 *   Expenses > Groceries, Utilities, Housing, Transportation, Other Expenses
 *   Equity > Opening Balances, Imbalance-USD
 */

import { createWriteStream } from 'fs';
import { createGzip } from 'zlib';
import { pipeline, Readable } from 'stream';
import { promisify } from 'util';
import { v4 as uuid } from 'uuid';

const pipelineAsync = promisify(pipeline);

function guid() {
  return uuid().replace(/-/g, '');
}

function placeholderAccount(id, name, type, parentId) {
  return `<gnc:account version="2.0.0">
  <act:name>${name}</act:name>
  <act:id type="guid">${id}</act:id>
  <act:type>${type}</act:type>
  <act:commodity>
    <cmdty:space>CURRENCY</cmdty:space>
    <cmdty:id>USD</cmdty:id>
  </act:commodity>
  <act:commodity-scu>100</act:commodity-scu>
  <act:slots>
    <slot>
      <slot:key>placeholder</slot:key>
      <slot:value type="string">true</slot:value>
    </slot>
  </act:slots>
  <act:parent type="guid">${parentId}</act:parent>
</gnc:account>`;
}

function account(id, name, type, parentId) {
  return `<gnc:account version="2.0.0">
  <act:name>${name}</act:name>
  <act:id type="guid">${id}</act:id>
  <act:type>${type}</act:type>
  <act:commodity>
    <cmdty:space>CURRENCY</cmdty:space>
    <cmdty:id>USD</cmdty:id>
  </act:commodity>
  <act:commodity-scu>100</act:commodity-scu>
  <act:parent type="guid">${parentId}</act:parent>
</gnc:account>`;
}

export async function createNewGnuCashFile(filePath) {
  // Generate GUIDs for all accounts
  const ids = {
    root:          guid(),
    assets:        guid(),
    checking:      guid(),
    savings:       guid(),
    liabilities:   guid(),
    creditCard:    guid(),
    income:        guid(),
    salary:        guid(),
    otherIncome:   guid(),
    expenses:      guid(),
    groceries:     guid(),
    utilities:     guid(),
    housing:       guid(),
    transport:     guid(),
    otherExpenses: guid(),
    equity:        guid(),
    openingBal:    guid(),
    imbalance:     guid(),
  };

  const accounts = [
    // ROOT (no parent, no commodity needed)
    `<gnc:account version="2.0.0">
  <act:name>Root Account</act:name>
  <act:id type="guid">${ids.root}</act:id>
  <act:type>ROOT</act:type>
</gnc:account>`,

    // Assets
    placeholderAccount(ids.assets,      'Assets',            'ASSET',   ids.root),
    account(ids.checking,  'Checking Account',  'BANK',    ids.assets),
    account(ids.savings,   'Savings Account',   'BANK',    ids.assets),

    // Liabilities
    placeholderAccount(ids.liabilities, 'Liabilities',       'LIABILITY', ids.root),
    account(ids.creditCard,'Credit Card',       'CREDIT',    ids.liabilities),

    // Income
    placeholderAccount(ids.income,      'Income',            'INCOME',  ids.root),
    account(ids.salary,    'Salary',            'INCOME',  ids.income),
    account(ids.otherIncome,'Other Income',     'INCOME',  ids.income),

    // Expenses
    placeholderAccount(ids.expenses,    'Expenses',          'EXPENSE', ids.root),
    account(ids.groceries, 'Groceries',         'EXPENSE', ids.expenses),
    account(ids.utilities, 'Utilities',         'EXPENSE', ids.expenses),
    account(ids.housing,   'Housing',           'EXPENSE', ids.expenses),
    account(ids.transport, 'Transportation',    'EXPENSE', ids.expenses),
    account(ids.otherExpenses,'Other Expenses', 'EXPENSE', ids.expenses),

    // Equity
    placeholderAccount(ids.equity,      'Equity',            'EQUITY',  ids.root),
    account(ids.openingBal,'Opening Balances',  'EQUITY',  ids.equity),
    account(ids.imbalance, 'Imbalance-USD',     'EQUITY',  ids.equity),
  ];

  const accountCount = accounts.length;
  const bookId = guid();

  const xml = `<?xml version="1.0" encoding="utf-8" ?>
<gnc-v2 xmlns:gnc="http://www.gnucash.org/XML/gnc"
        xmlns:act="http://www.gnucash.org/XML/act"
        xmlns:book="http://www.gnucash.org/XML/book"
        xmlns:cd="http://www.gnucash.org/XML/cd"
        xmlns:cmdty="http://www.gnucash.org/XML/cmdty"
        xmlns:price="http://www.gnucash.org/XML/price"
        xmlns:slot="http://www.gnucash.org/XML/slot"
        xmlns:split="http://www.gnucash.org/XML/split"
        xmlns:trn="http://www.gnucash.org/XML/trn"
        xmlns:ts="http://www.gnucash.org/XML/ts">
<gnc:book version="2.0.0">
<book:id type="guid">${bookId}</book:id>
<book:slots>
  <slot>
    <slot:key>features</slot:key>
    <slot:value type="frame">
      <slot>
        <slot:key>Split/Order</slot:key>
        <slot:value type="string">1</slot:value>
      </slot>
    </slot:value>
  </slot>
</book:slots>
<gnc:count-data cd:type="account">${accountCount}</gnc:count-data>
<gnc:count-data cd:type="transaction">0</gnc:count-data>
${accounts.join('\n')}
</gnc:book>
</gnc-v2>`;

  await pipelineAsync(
    Readable.from([xml]),
    createGzip({ level: 9 }),
    createWriteStream(filePath)
  );

  return { accountCount, ids };
}
