-- Gera usuários de carga com volumes diferentes, direto no Postgres (generate_series).
-- Vencimentos espalhados de jan/2025 a dez/2027; o que venceu antes de hoje fica ~75% pago.
CREATE OR REPLACE FUNCTION load_user(uid text, n_sup int, n_bol int, n_tax int) RETURNS void AS $$
BEGIN
  INSERT INTO users (id, name, email, "passwordHash", provider, role, "createdAt", "updatedAt")
  VALUES (uid, 'Carga ' || uid, uid || '@carga.test', NULL, 'LOCAL', 'USER', now(), now());

  INSERT INTO suppliers (id, "userId", "tradeName", "legalName", document, category, "createdAt", "updatedAt")
  SELECT uid || '_s' || g, uid, 'Fornecedor ' || g || ' ' || left(md5(g::text), 6), 'Razao ' || g || ' LTDA',
         lpad(g::text, 14, '0'), (ARRAY['Insumos','Servicos','Aluguel','Energia'])[1 + g % 4], now(), now()
  FROM generate_series(1, n_sup) g;

  INSERT INTO boletos (id, "userId", "supplierId", "invoiceNumber", "amountCents", "feesCents", "dueDate",
                       barcode, status, "paidAt", "boletoReceived", "createdAt", "updatedAt")
  SELECT uid || '_b' || g, uid, uid || '_s' || (1 + g % n_sup), 'NF' || g,
         1000 + ((g::bigint * 7919) % 500000)::int, CASE WHEN g % 10 = 0 THEN 350 ELSE 0 END, d,
         '34191' || lpad(g::text, 42, '0'),
         CASE WHEN d < current_date AND g % 4 <> 0 THEN 'PAGO'::"PaymentStatus" ELSE 'PENDENTE'::"PaymentStatus" END,
         CASE WHEN d < current_date AND g % 4 <> 0 THEN d ELSE NULL END,
         g % 5 <> 0, now(), now()
  FROM (SELECT g, (date '2025-01-01' + ((g * 37) % 1095))::date AS d FROM generate_series(1, n_bol) g) x;

  INSERT INTO taxes (id, "userId", name, "revenueCode", "amountCents", "dueDate", "referenceMonth", "paymentCode",
                     status, "paidAt", "invoiceNumber", "supplierId", "goodsDelivered", "createdAt", "updatedAt")
  SELECT uid || '_t' || g, uid, (ARRAY['DARF','DAS','IPTU','ICMS','ISS'])[1 + g % 5], lpad((g % 9999)::text, 4, '0'),
         500 + ((g::bigint * 104729) % 900000)::int, d, date_trunc('month', d - 20)::date, '8580' || lpad(g::text, 44, '0'),
         CASE WHEN d < current_date AND g % 4 <> 0 THEN 'PAGO'::"PaymentStatus" ELSE 'PENDENTE'::"PaymentStatus" END,
         CASE WHEN d < current_date AND g % 4 <> 0 THEN d ELSE NULL END,
         'T' || g, CASE WHEN g % 3 = 0 THEN uid || '_s' || (1 + g % n_sup) END,
         CASE WHEN g % 3 = 0 THEN g % 6 <> 0 END, now(), now()
  FROM (SELECT g, (date '2025-01-01' + ((g * 53) % 1095))::date AS d FROM generate_series(1, n_tax) g) x;
END $$ LANGUAGE plpgsql;

TRUNCATE users CASCADE;

-- Volumes crescentes num único usuário (cenário "muitos registros")
SELECT load_user('vol_1k',    100,   1000,   1000);
SELECT load_user('vol_10k',   500,  10000,  10000);
SELECT load_user('vol_100k', 2000, 100000, 100000);
SELECT load_user('vol_500k', 5000, 500000, 500000);

-- 200 usuários "normais" para o cenário de acessos simultâneos
SELECT load_user('conc_' || i, 50, 300, 300) FROM generate_series(1, 200) i;

ANALYZE;
SELECT 'users' t, count(*) FROM users UNION ALL SELECT 'suppliers', count(*) FROM suppliers
UNION ALL SELECT 'boletos', count(*) FROM boletos UNION ALL SELECT 'taxes', count(*) FROM taxes;
