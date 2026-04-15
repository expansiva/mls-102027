/// <mls fileReference="_102027_/l2/agents/skills/genContract.defs.ts" enhancement="_blank"/>

export const ex = `
{
  "interfaces": {               // mapa de interfaces
    "NomeInterface": {
      "fields": [
        {
          "name":     "fieldName",          // string — nome do campo
          "type":     "string | number | boolean | NomeInterface | string[]",
          "optional": true                // boolean — omitir = obrigatório
        }
      ],
      "extends":  "OutraInterface"     // opcional — herança
    }
  },

  "types": {                     // type aliases
    "NomeType": {
      "definition": "string | number | NomeInterface"
    }
  },

  "enums": {                     // enumeradores
    "NomeEnum": {
      "values": [
        { "key": "SAVE",   "value": "save" },
        { "key": "DELETE", "value": "delete" }
      ]
    }
  },

  "constants": {                 // constantes exportadas
    "NOME_CONSTANTE": {
      "type":  "string",
      "value": "valor"
    }
  }
}
`