import { format, isPast, parseISO } from 'date-fns';

export const formatDate = (date) => (date ? format(parseISO(date), 'dd MMM yyyy') : 'No date');
export const isOverdue = (date, status) => status !== 'Completed' && date && isPast(parseISO(date));
