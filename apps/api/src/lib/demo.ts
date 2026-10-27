// Usuário demo com dados fictícios relativos à data de hoje, para que o
// dashboard sempre tenha itens pagos, pendentes e atrasados.
import { PaymentStatus, type PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { todayISO } from "@tributoleao/shared";

export const DEMO_EMAIL = "demo@tributoleao.app";
export const DEMO_PASSWORD = "demo1234"; // credencial pública de demonstração

/** Retorna o usuário demo, criando-o com dados de exemplo se ainda não existir. */
export async function ensureDemoUser(prisma: PrismaClient) {
  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  return existing ?? seedDemoUser(prisma);
}

/** Recria o usuário demo do zero (apaga dados anteriores em cascata). */
export async function seedDemoUser(prisma: PrismaClient) {
  const [y, m, d] = todayISO().split("-").map(Number) as [number, number, number];
  const day = (offset: number) => new Date(Date.UTC(y, m - 1, d + offset));
  const month = (offset: number) => new Date(Date.UTC(y, m - 1 + offset, 1));

  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });

  const user = await prisma.user.create({
    data: {
      name: "Usuário Demo",
      email: DEMO_EMAIL,
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
    },
  });

  const createSupplier = (legalName: string, tradeName: string, document: string, category: string, domain: string) =>
    prisma.supplier.create({
      data: { userId: user.id, legalName, tradeName, document, category, email: `financeiro@${domain}.com.br` },
    });

  // CNPJs fictícios com dígitos verificadores válidos
  const energia = await createSupplier("Luz & Força Distribuidora S.A.", "Luz & Força", "11222333000181", "Energia", "luzeforca");
  const internet = await createSupplier("Conecta Telecom Ltda.", "Conecta", "45723174000110", "Internet e Telefonia", "conecta");
  const papelaria = await createSupplier("Papelaria Central ME", "Papelaria Central", "19131243000197", "Material de escritório", "papelariacentral");
  const aluguel = await createSupplier("Imobiliária Horizonte Ltda.", "Horizonte", "60701190000104", "Aluguel", "horizonte");
  const contabil = await createSupplier("Contábil Prisma Assessoria", "Prisma Contábil", "33000167000101", "Contabilidade", "prismacontabil");

  await prisma.boleto.createMany({
    data: [
      { supplierId: aluguel.id, description: "Aluguel do escritório", amountCents: 350000, issueDate: day(-40), dueDate: day(-30), status: PaymentStatus.PAGO, paidAt: day(-31) },
      { supplierId: energia.id, description: "Conta de energia", amountCents: 48790, issueDate: day(-25), dueDate: day(-5) },
      { supplierId: internet.id, description: "Plano de internet 500MB", amountCents: 19990, feesCents: 400, issueDate: day(-20), dueDate: day(-2) },
      { supplierId: aluguel.id, description: "Aluguel do escritório", amountCents: 350000, issueDate: day(-10), dueDate: day(2) },
      { supplierId: contabil.id, description: "Honorários contábeis", amountCents: 120000, issueDate: day(-8), dueDate: day(5) },
      { supplierId: papelaria.id, description: "Resmas de papel e toner", amountCents: 31550, issueDate: day(-3), dueDate: day(12) },
      { supplierId: energia.id, description: "Conta de energia", amountCents: 51230, issueDate: day(-55), dueDate: day(-35), status: PaymentStatus.PAGO, paidAt: day(-36) },
    ].map((b) => ({ ...b, userId: user.id, barcode: "34191790010104351004791020150008291070026000" })),
  });

  await prisma.tax.createMany({
    data: [
      { name: "DAS", revenueCode: "Simples Nacional", amountCents: 284315, referenceMonth: month(-2), dueDate: day(-38), status: PaymentStatus.PAGO, paidAt: day(-39) },
      { name: "DAS", revenueCode: "Simples Nacional", amountCents: 301240, referenceMonth: month(-1), dueDate: day(-3) },
      { name: "DARF", revenueCode: "0561", amountCents: 98750, referenceMonth: month(-1), dueDate: day(4) },
      { name: "ISS", revenueCode: "ISS-Prestação", amountCents: 45000, referenceMonth: month(-1), dueDate: day(8) },
      { name: "IPTU", revenueCode: "Parcela 10/10", amountCents: 27890, referenceMonth: month(0), dueDate: day(15) },
      { name: "FGTS", revenueCode: "FGTS Digital", amountCents: 64000, referenceMonth: month(-1), dueDate: day(-12), status: PaymentStatus.PAGO, paidAt: day(-13) },
    ].map((t) => ({ ...t, userId: user.id, paymentCode: "85890000002843150328240101202601000000000000" })),
  });

  return user;
}
