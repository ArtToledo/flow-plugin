# Roteamento de revisores

O roteamento é feito por `scripts/route.mjs`, que cruza `git diff --name-only <base-da-fatia>...HEAD` com `flow.json.routing`.

| Revisor             | Quando roda                                                                 |
| ------------------- | --------------------------------------------------------------------------- |
| `code-reviewer`     | Sempre                                                                      |
| `security-reviewer` | Algum arquivo casa com `routing.security`                                   |
| `ux-reviewer`       | Algum arquivo casa com `routing.ux`                                         |
| `ui-reviewer`       | Algum arquivo casa com `routing.ui`                                         |
| `browser-tester`    | `flow.json.browser` existe e algum arquivo casa com `routing.browser` (ou, sem ele, com `ui` ou `ux`) |

## Sintaxe dos globs

- `*` casa qualquer coisa dentro de um segmento; `**` casa qualquer profundidade; `?` casa um caractere; `{a,b}` casa alternativas.
- Padrão **sem** `/` casa com o nome do arquivo em qualquer pasta (`Dockerfile`, `package.json`, `*.tf`), como no `.gitignore`.
- Padrão **com** `/` é ancorado na raiz do repositório (`src/**/*.tsx`).

## Padrões sugeridos pelo /flow-init

Ajuste conforme a estrutura detectada. Em monorepo, prefixe com `apps/web/` e assim por diante.

```json
{
  "ui": ["**/*.tsx", "**/*.jsx", "**/*.vue", "**/*.svelte", "**/*.css", "**/*.scss", "**/tailwind.config.*"],
  "ux": ["src/app/**", "src/pages/**", "src/screens/**", "app/**/page.*", "**/*form*.*"],
  "security": [
    "**/auth/**", "**/*auth*.*", "**/*.controller.ts", "**/routes/**", "**/middleware*/**",
    "**/migrations/**", "Dockerfile", "docker-compose*.yml", "*.tf", "**/.github/workflows/**",
    "package.json", "*.lock", "package-lock.json", "pnpm-lock.yaml", ".env.example"
  ]
}
```

Um arquivo pode acionar mais de um revisor. Arquivos que não casam com nada ficam só com o `code-reviewer`.
