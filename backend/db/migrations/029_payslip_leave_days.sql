-- "Payroll integration" on a Time Off Type was previously just a stored
-- flag with no effect anywhere - the payroll engine never looked at leave
-- at all. This column is what makes computing a payslip actually record
-- how many approved-leave days (under a type marked to affect payroll)
-- fell inside the period, so it can be shown and reasoned about rather
-- than silently absorbed into "no attendance recorded".
ALTER TABLE payslips ADD COLUMN leave_days NUMERIC(5,2) NOT NULL DEFAULT 0;
