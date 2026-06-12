// ============================================================
//  CONFIGURAÇÃO — FKG ADVOGADOS
// ============================================================

const CONFIG = {
  // Azure AD → App registrations → FKG Advogados
  CLIENT_ID: "4ea36f97-ddd5-4382-89ea-469820e06375",
  TENANT_ID: "a4e51e86-c3a7-4d4c-a0ca-e004030c3bb5",

  // URI de redirecionamento registrada no Azure AD
  REDIRECT_URI: "https://elisontown-star.github.io/FKGADVOGADOS/taskpane.html",

  // URL do site SharePoint (sem barra no final) — mantido para compatibilidade
  SITE_URL: "https://fkgadv.sharepoint.com/sites/ArmazemJuridico",

  // Nome da biblioteca de documentos onde os emails serão salvos — mantido para compatibilidade
  LIBRARY_NAME: "Armazém Juridico",

  // ── Múltiplas bibliotecas ────────────────────────────────────
  // Adicione ou remova entradas conforme necessário.
  // "label" aparece no dropdown; "siteUrl" e "libraryName" definem o destino.
  SITES: [
    {
      label:       "Armazém Jurídico",
      siteUrl:     "https://fkgadv.sharepoint.com/sites/ArmazemJuridico",
      libraryName: "Armazém Juridico"
    },
    {
      label:       "Modelos",
      siteUrl:     "https://fkgadv.sharepoint.com/sites/modelos",
      libraryName: "Modelos - FKG Advogados"
    }
  ],

  // Escopos necessários para a Graph API
  // "openid" e "profile" são obrigatórios para o SSO nativo do Office funcionar
  // "offline_access" NÃO deve ter o prefixo de URL
  SCOPES: [
    "openid",
    "profile",
    "https://graph.microsoft.com/Mail.Read",
    "https://graph.microsoft.com/Files.ReadWrite.All",
    "https://graph.microsoft.com/Sites.ReadWrite.All",
    "offline_access"
  ]
};
