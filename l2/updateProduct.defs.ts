/// <mls fileReference="_102027_/l2/updateProduct.defs.ts" enhancement="_blank"/>

export const contractSpec = {
  "interfaces": {
    "PetshopProduct": {
      "fields": [
        { "name": "id",         "type": "string" },
        { "name": "name",       "type": "string" },
        { "name": "price",      "type": "number" },
        { "name": "categoryId", "type": "string" },
        { "name": "imageUrl",   "type": "string", "optional": true },
        { "name": "active",     "type": "boolean" }
      ]
    },
    "PetshopGetProductParams": {
      "fields": [
        { "name": "productId", "type": "string" },
        { "name": "shopId",    "type": "string" }
      ]
    },
    "PetshopCategory": {           
      "fields": [
        { "name": "id",   "type": "string" },
        { "name": "name", "type": "string" }
      ]
    },
    "PetshopListCategoriesParams": {  
      "fields": [
        { "name": "shopId", "type": "string" }
      ]
    }
  
  },

  "enums": {
    "PetshopAction": {
      "values": [
        { "key": "LOAD",   "value": "load"   },
        { "key": "SAVE",   "value": "save"   },
        { "key": "DELETE", "value": "delete" },
        { "key": "CANCEL", "value": "cancel" },
        { "key": "LOAD_CATEGORIES", "value": "load_categories" }   
      ]
    }
  },

  "types": {
    "PetshopProductId": { "definition": "string" }
  },

  "constants": {
    "PETSHOP_API_VERSION": { "type": "string", "value": "v1" }
  }
}

export const sharedSpec = {
  "className":      "PetshopProductShared",

  "interfacesPath": "_102027_/l1/petshop/layer_2_controller/updateProduct.js",
  "interfaces": {
    "PetshopProduct": {
      "fields": [
        { "name": "id",         "type": "string" },
        { "name": "name",       "type": "string" },
        { "name": "price",      "type": "number" },
        { "name": "categoryId", "type": "string" },
        { "name": "imageUrl",   "type": "string", "optional": true },
        { "name": "active",     "type": "boolean" }
      ]
    },
    "PetshopGetProductParams": {
      "fields": [
        { "name": "productId", "type": "string" },
        { "name": "shopId",    "type": "string" }
      ]
    },
    "PetshopCategory": {           
      "fields": [
        { "name": "id",   "type": "string" },
        { "name": "name", "type": "string" }
      ]
    },
    "PetshopListCategoriesParams": {  
      "fields": [
        { "name": "shopId", "type": "string" }
      ]
    }
  
  },

  "properties": [
    {
      "name":    "productId",
      "type":    "string",
      "default": "",
      "reflect": false
    }
  ],

  "states": [
    // controle
    { "name": "action",  "type": "PetshopAction | null", "default": null,  "reset": true },
    { "name": "loading", "type": "boolean", "default": false },
    { "name": "error", "type": "string | null", "default": null },
    { "name": "categories", "type": "PetshopCategory[]",     "default": []    },

    // campos de PetshopProduct — prefixo "product_"
    { "name": "product_id",         "type": "string",  "default": "",    "interfaceGroup": "PetshopProduct", "field": "id" },
    { "name": "product_name",       "type": "string",  "default": "",    "interfaceGroup": "PetshopProduct", "field": "name" },
    { "name": "product_price",      "type": "number",  "default": 0,     "interfaceGroup": "PetshopProduct", "field": "price" },
    { "name": "product_categoryId", "type": "string",  "default": "",    "interfaceGroup": "PetshopProduct", "field": "categoryId" },
    { "name": "product_imageUrl",   "type": "string",  "default": "",    "interfaceGroup": "PetshopProduct", "field": "imageUrl" },
    { "name": "product_active",     "type": "boolean", "default": true,  "interfaceGroup": "PetshopProduct", "field": "active" }
  ],

  "actions": [
    {
      "trigger": { "state": "action", "value": "PetshopAction.LOAD" },
      "method": "_load",
      "useMock": true,
      "bff": {
        "fn":      "petshop.getProduct",
        "params":  "PetshopGetProductParams",  // ✓ existe no contract
        "result": "PetshopProduct",           // ✓ existe no contract
        "onStart":   [{ "state": "loading", "value": "true" }],
        "onSuccess": [
          { "state": "product_id",         "value": "result.id" },
          { "state": "product_name",       "value": "result.name" },
          { "state": "product_price",      "value": "result.price" },
          { "state": "product_categoryId", "value": "result.categoryId" },
          { "state": "product_imageUrl",   "value": "result.imageUrl" },
          { "state": "product_active",     "value": "result.active" },
          { "state": "loading",            "value": "false" }
        ],
        "onError": [{ "state": "loading", "value": "false" }]
      }
    },
    {
      "trigger": { "state": "action", "value": "PetshopAction.SAVE" },
      "method": "_save",
      "bff": {
        "fn":      "petshop.updateProduct",
        "params":  "PetshopProduct",  // ✓ usa PetshopProduct como params de update
        "result":  "PetshopProduct",  // ✓ existe no contract
        "onStart":   [{ "state": "loading", "value": "true" }],
        "onSuccess": [{ "state": "loading", "value": "false" }],
        "onError":   [{ "state": "loading", "value": "false" },{ "state": "error",   "value": "error.message" } ]
      }
    },  
    {
      // ← adicionado
      "trigger": { "state": "action", "value": "PetshopAction.LOAD_CATEGORIES" },
      "method": "_loadCategories",
      "useMock": true,
      "bff": {
        "fn":      "petshop.listCategories",
        "params":  "PetshopListCategoriesParams",
        "result": "PetshopCategory[]",
        "onStart":   [],
        "onSuccess": [{ "state": "categories", "value": "result" }],
        "onError":   []
      }
    },
    {
      // ← adicionado — CANCEL não chama bff, apenas reseta estados
      "trigger": { "state": "action", "value": "PetshopAction.CANCEL" },
      "method": "_cancel",
      "bff": null,  // sem chamada ao backend
      "onStart": [
        { "state": "error",   "value": "null"  },
        { "state": "loading", "value": "false" }
      ]
    }
  ],

  "lifecycle": {
    "connectedCallback": {
      "dispatchAction": ["PetshopAction.LOAD", "PetshopAction.LOAD_CATEGORIES"]
    }
  }
}

export const desktopLayoutSpec = {
  "className":  "PetshopUpdateProduct",
  "tagName":    "petshop--web--desktop--update-product-102027",
  "extends":    "PetshopProductShared",
  "styling": "classes-only",
  "imports": [
    { "type": "value", "import": "{PetshopAction}", "path": "_102027_/l1/petshop/layer_2_controller/updateProduct.js" },
    { "type": "value", "import":"{PetshopProductShared}", "path": "/_102027_/l2/petshop/web/shared/updateProduct.js" }
  ],

  "render": {

    // Avaliados em ordem — primeiro que bater retorna imediatamente
    "conditions": [
      { "if": "this.loading", "return": "loading" },
      { "if": "this.error",   "return": "error"   }
    ],

    "blocks": {

      // ─── BLOCO: loading ───────────────────────────────────────────
      "loading": {
        "element": "div",
        "class":   "loading",
        "children": [
          { "element": "span", "class": "spinner" },
          { "element": "span", "class": "loading__message", "i18n": "loading" }
        ]
      },

      // ─── BLOCO: error ─────────────────────────────────────────────
      "error": {
        "element": "div",
        "class":   "error",
        "children": [
          {
            "element": "span",
            "class":   "error__message",
            "bind":    "this.error"     // lê o state error do shared
          },
          {
            "element": "button",
            "class":   "btn btn--secondary",
            "i18n":    "retry",
            "event": {
              "on":     "click",
              "type":   "action",       // seta state de controle
              "state":  "action",       // this.action =
              "value":  "PetshopAction.LOAD"  // = PetshopAction.LOAD
            }
          }
        ]
      },

      // ─── BLOCO: default ───────────────────────────────────────────
      "default": {
        "element": "form",
        "class":   "update-product",
        "event": {
          "on":      "submit",
          "type":    "action",            // seta state de controle
          "state":   "action",            // this.action =
          "value":   "PetshopAction.SAVE", // = PetshopAction.SAVE
          "prevent": true                 // e.preventDefault()
        },
        "children": [

          // ── duas colunas ──────────────────────────────────────────
          {
            "element": "div",
            "class":   "update-product__cols",
            "children": [

              // coluna 1
              {
                "element": "div",
                "class":   "update-product__col",
                "children": [
                  {
                    "element": "label", "class": "field", "i18n": "name",
                    "input": {
                      "type":  "text",
                      "class": "field__input",
                      "bind":  "product_name",   // .value=${this.product_name}
                      "event": {
                        "on":    "input",
                        "type":  "set",           // seta state de dado
                        "state": "product_name", // this.product_name =
                        "cast":  "string"        // (e.target as HTMLInputElement).value
                      }
                    }
                  },
                  {
                    "element": "label", "class": "field", "i18n": "price",
                    "input": {
                      "type":  "number",
                      "class": "field__input",
                      "bind":  "product_price",
                      "event": {
                        "on":    "input",
                        "type":  "set",
                        "state": "product_price",
                        "cast":  "number"         // Number((e.target as HTMLInputElement).value)
                      }
                    }
                  },
                  {
                    "element": "label", "class": "field", "i18n": "active",
                    "input": {
                      "type":  "checkbox",
                      "class": "field__checkbox",
                      "bind":  "product_active",  // ?checked=${this.product_active}
                      "event": {
                        "on":    "change",
                        "type":  "set",
                        "state": "product_active",
                        "cast":  "boolean"        // (e.target as HTMLInputElement).checked
                      }
                    }
                  }
                ]
              },

              // coluna 2
              {
                "element": "div",
                "class":   "update-product__col",
                "children": [
                  {
                    "element": "label", "class": "field", "i18n": "imageUrl",
                    "input": {
                      "type":  "url",
                      "class": "field__input",
                      "bind":  "product_imageUrl",
                      "event": {
                        "on":    "input",
                        "type":  "set",
                        "state": "product_imageUrl",
                        "cast":  "string"
                      }
                    }
                  }
                ]
              }
            ]
          },

          // ── largura total ─────────────────────────────────────────
          {
            "element": "div",
            "class":   "update-product__full",
            "children": [
              {
                "element": "label", "class": "field", "i18n": "categoryId",
                "input": {
                  "type":  "select",
                  "class": "field__select",
                  "bind":  "product_categoryId",  // .value=${this.product_categoryId}
                  "options": {
                    "source": "this.categories",   // state do shared com a lista
                    "value":  "id",               // campo usado como option value
                    "label":  "name"              // campo usado como option label
                  },
                  "event": {
                    "on":    "change",
                    "type":  "set",
                    "state": "product_categoryId",
                    "cast":  "string"
                  }
                }
              }
            ]
          },

          // ── ações ─────────────────────────────────────────────────
          {
            "element": "div",
            "class":   "update-product__actions",
            "children": [
              {
                "element":  "button",
                "class":    "btn btn--secondary",
                "type":     "button",
                "i18n":     "cancel",
                "event": {
                  "on":    "click",
                  "type":  "action",
                  "state": "action",
                  "value": "PetshopAction.CANCEL"  // this.action = PetshopAction.CANCEL
                }
              },
              {
                "element":    "button",
                "class":      "btn btn--primary",
                "type":       "submit",
                "i18n":       "save",
                "disabled":   "this.loading"  // ?disabled=${this.loading}
              }
            ]
          }

        ]
      }
    }
  },

  "i18n": {
    "default":   "en",
    "languages": ["en", "pt"],
    "keys": [
      "name", "price", "active", "imageUrl",
      "categoryId", "cancel", "save", "loading", "retry"
    ]
  }
}

export const lessSpec = {
  "tagName":    "petshop--web--desktop--update-product-102027",
  "layout": {
    // descreve a estrutura visual para o agente entender o contexto
    "type":    "form",
    "columns": 2,
    "states":  ["loading", "error", "default"]
  },

  "classes": [

    // ── estado loading ────────────────────────────────────────────
    {
      "name":    "loading",
      "role":    "state-container",
      "context": "shown when this.loading is true"
    },
    {
      "name":    "spinner",
      "role":    "loading-indicator",
      "context": "animated spinner inside loading state"
    },
    {
      "name":    "loading__message",
      "role":    "text",
      "context": "loading label next to spinner"
    },

    // ── estado error ──────────────────────────────────────────────
    {
      "name":    "error",
      "role":    "state-container",
      "context": "shown when this.error is truthy"
    },
    {
      "name":    "error__message",
      "role":    "text",
      "context": "error message text inside error state"
    },

    // ── form e layout ─────────────────────────────────────────────
    {
      "name":    "update-product",
      "role":    "form-root",
      "context": "root form element of the default state"
    },
    {
      "name":    "update-product__cols",
      "role":    "columns-container",
      "context": "wraps the two side-by-side columns"
    },
    {
      "name":    "update-product__col",
      "role":    "column",
      "context": "individual column inside cols container"
    },
    {
      "name":    "update-product__full",
      "role":    "full-width-row",
      "context": "full width row below the two columns"
    },
    {
      "name":    "update-product__actions",
      "role":    "actions-row",
      "context": "row with cancel and save buttons, aligned to the right"
    },

    // ── campos ────────────────────────────────────────────────────
    {
      "name":    "field",
      "role":    "field-wrapper",
      "context": "label wrapping a form input, displayed as block"
    },
    {
      "name":    "field__input",
      "role":    "text-input",
      "context": "text, number and url inputs inside a field"
    },
    {
      "name":    "field__checkbox",
      "role":    "checkbox-input",
      "context": "checkbox input inside a field"
    },
    {
      "name":    "field__select",
      "role":    "select-input",
      "context": "select dropdown inside a field"
    },

    // ── botões ────────────────────────────────────────────────────
    {
      "name":    "btn",
      "role":    "button-base",
      "context": "base class for all buttons — shared sizing and shape"
    },
    {
      "name":    "btn--primary",
      "role":    "button-variant",
      "context": "primary action button — submit / save"
    },
    {
      "name":    "btn--secondary",
      "role":    "button-variant",
      "context": "secondary action button — cancel / retry"
    }
  ]
}

export const materializeIndex: mls.defs.MaterializeIndex = [
  {
    "id": "contract",
    "specVar": "contractSpec",
    "outputPath": "/l1/petshop/layer_2_controller/updateProduct.ts",
    "skillPath": "_102027_/l2/agents/skills/genContract.ts",
    "agent": "agentMaterializeContract",
    "dependsOn": [],
    "specUpdatedAt": "2026-04-10T14:00:00Z"
  },
  {
    "id": "shared",
    "specVar": "sharedSpec",
    "outputPath": "/l2/petshop/web/shared/updateProduct.ts",
    "skillPath": "_102027_/l2/agents/skills/genPageShared.ts",
    "agent": "agentMaterializeSharedPage",
    "dependsOn": ["contract"],
    "specUpdatedAt": "2026-04-10T14:00:00Z"
  },
  {
    "id": "desktop",
    "specVar": "desktopLayoutSpec",
    "outputPath": "/l2/petshop/web/desktop/updateProduct.ts",
    "skillPath": "_102027_/l2/agents/skills/genPageRender.ts",
    "agent": "agentMaterializePageLit",
    "dependsOn": ["shared"],
    "specUpdatedAt": "2026-04-10T14:00:00Z",
  },
  {
    "id": "desktop-less",
    "specVar": "lessSpec",
    "outputPath": "/l2/petshop/web/desktop/updateProduct.less",
    "skillPath": "_102027_/l2/agents/skills/genLess.ts",
    "agent": "agentMaterializeLess",
    "dependsOn": ["shared"],
    "specUpdatedAt": "2026-04-10T14:00:00Z",
  }

];