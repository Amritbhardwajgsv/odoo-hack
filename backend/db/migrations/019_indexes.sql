CREATE INDEX idx_contracts_employee_period ON contracts (employee_id, start_date, end_date);
CREATE INDEX idx_attendance_employee_date ON attendance (employee_id, attendance_date);
CREATE INDEX idx_timeoff_requests_employee ON time_off_requests (employee_id, status);
CREATE INDEX idx_payslips_payrun ON payslips (payrun_id);
CREATE INDEX idx_payslip_lines_payslip ON payslip_lines (payslip_id);
CREATE INDEX idx_audit_log_entity ON audit_log (entity_type, entity_id);
