-- O controle dos boletos passa a ser se o fornecedor mandou o boleto, não a entrega da mercadoria
ALTER TABLE "boletos" DROP COLUMN "goodsDelivered";
ALTER TABLE "boletos" ADD COLUMN     "boletoReceived" BOOLEAN NOT NULL DEFAULT true;
