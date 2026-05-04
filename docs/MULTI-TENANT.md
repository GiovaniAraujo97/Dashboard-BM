# Multi-tenant (Empresas isoladas)

Este projeto agora usa modelo de empresas (tenants):
- Cada empresa tem seus dados isolados.
- Usuários da mesma empresa compartilham os mesmos dados.
- Usuários de empresas diferentes nao enxergam dados entre si.

## Fluxo de uso

1. Dono da empresa cria conta (email + senha) e deixa o campo Codigo da empresa em branco.
2. O sistema cria uma nova empresa para essa conta.
3. O sistema gera um codigo de convite da empresa.
4. Pessoas de confianca criam conta com email/senha proprios e informam o codigo da empresa.
5. Todos da mesma empresa passam a ver os mesmos clientes/emprestimos/pagamentos.

## Campos no cadastro

- Nome da empresa: usar quando estiver criando uma empresa nova.
- Codigo da empresa: usar quando estiver entrando em uma empresa ja existente.

Se o Supabase exigir confirmacao de email, o sistema salva o setup de empresa e aplica automaticamente no primeiro login apos confirmacao.

## Banco (Supabase)

Aplicar o script SQL:
- docs/sql/multitenant-setup.sql

Tabelas principais:
- tenants: cadastro das empresas.
- user_tenants: vinculo usuario -> empresa e papel.
- user_data: dados compartilhados por empresa (tenant_id).

## Observacao importante

Este modelo usa um unico banco com isolamento por tenant (RLS).
Se voce quiser banco fisicamente separado por cliente comprador, sera necessario provisionamento por projeto/instancia separado (fora do frontend).
