import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const rooms = sqliteTable('rooms', {
  code: text('code').primaryKey(),
  host: text('host').notNull(),
  phone: text('phone'),
  expires: integer('expires').notNull(),
  offer: text('offer'),
  answer: text('answer'),
  input: text('input'),
  status: text('status'),
});
