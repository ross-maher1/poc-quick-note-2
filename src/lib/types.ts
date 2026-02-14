/**
 * Core type definitions for the app.
 *
 * Define all shared types here. Use discriminated unions for items
 * that can be multiple types.
 *
 * Example:
 *
 * export type Item = {
 *   id: string;
 *   title: string;
 *   createdAt: string;
 * };
 *
 * export type ListItem = Item | Divider;
 *
 * export type Divider = {
 *   id: string;
 *   isDivider: true;
 *   label: string;
 * };
 */

// Placeholder type - replace with your app's types
export type Item = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
};

// Note type - stored in Supabase
export type Note = {
  id: string;
  owner_id: string;
  content: string;
  created_at: string;
};
