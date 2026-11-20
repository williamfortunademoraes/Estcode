import { gzipSync } from 'node:zlib';

import { parseDistributionResponse, parseNfeDocument } from '@/services/nfe-api/src/nfe-parser';

const zip = (xml: string) => `<docZip NSU="000000000000042" schema="resNFe_v1.01.xsd">${gzipSync(Buffer.from(xml)).toString('base64')}</docZip>`;

describe('NF-e distribution parser', () => {
  it('reads a compressed summary and the SEFAZ checkpoint', () => {
    const doc = '<resNFe><chNFe>35261112345678000199550010000000011000000010</chNFe><CNPJ>12345678000199</CNPJ><xNome>Fornecedor</xNome><vNF>125.50</vNF></resNFe>';
    const result = parseDistributionResponse(`<Envelope><retDistDFeInt><cStat>138</cStat><xMotivo>Ok</xMotivo><ultNSU>42</ultNSU><maxNSU>50</maxNSU><loteDistDFeInt>${zip(doc)}</loteDistDFeInt></retDistDFeInt></Envelope>`);
    expect(result).toMatchObject({ cStat: 138, lastNsu: '42', maxNsu: '50' });
    expect(parseNfeDocument(result.documents[0]!.xml, result.documents[0]!.schema)).toMatchObject({ documentType: 'summary', issuerName: 'Fornecedor', totalAmount: 125.5 });
  });

  it('parses full invoice items and rejects DTD/entity declarations', () => {
    const xml = '<nfeProc><NFe><infNFe Id="NFe35261112345678000199550010000000011000000010"><emit><CNPJ>12345678000199</CNPJ></emit><det nItem="1"><prod><cProd>A1</cProd><xProd>Cafe</xProd><uCom>UN</uCom><qCom>2</qCom><vUnCom>12.50</vUnCom></prod></det></infNFe></NFe></nfeProc>';
    expect(parseNfeDocument(xml, 'procNFe_v4.00.xsd')).toMatchObject({ documentType: 'full', items: [{ supplierCode: 'A1', quantity: 2, unitPrice: 12.5 }] });
    expect(() => parseDistributionResponse('<!DOCTYPE x [<!ENTITY e "x">]><Envelope/>')).toThrow('NFE_XML_DTD_NOT_ALLOWED');
  });

  it('returns an empty batch for cStat 137', () => {
    expect(parseDistributionResponse('<Envelope><retDistDFeInt><cStat>137</cStat><xMotivo>Vazio</xMotivo><ultNSU>0</ultNSU><maxNSU>0</maxNSU></retDistDFeInt></Envelope>')).toMatchObject({ cStat: 137, documents: [] });
  });
});
