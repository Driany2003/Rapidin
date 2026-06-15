-- Indexes for module_rapidin_auto_payment_log: pagination + filtering performance
CREATE INDEX IF NOT EXISTS idx_auto_payment_log_created_at ON module_rapidin_auto_payment_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auto_payment_log_status ON module_rapidin_auto_payment_log(status);
