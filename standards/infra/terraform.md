# Terraform

Padrão de infraestrutura como código que o agente DevOps aplica ao gerar ou ajustar módulos e configurações `.tf` reais. O critério central: **o estado é remoto e travado, todo `apply` é precedido de um `plan` revisado por humano, e o framework NUNCA aplica sozinho — só prepara.** O `specs/DEPLOY.md` do projeto fixa o backend de estado, a estratégia de ambientes e os módulos concretos.

## Princípios

1. **Estado é compartilhado, remoto e travado.** State em backend remoto (S3+DynamoDB, GCS, Terraform/HCP Cloud) com lock. State local em time é corrupção esperando dois `apply` concorrentes — e vaza segredo no disco de quem clonar.
2. **`plan` antes de todo `apply`; humano no gate.** O agente gera e revisa o `plan`, descreve o diff e para. Aplicar é decisão humana explícita — a automação prepara, não executa `apply`/`destroy` por conta própria.
3. **Variável é tipada e descrita.** Toda `variable` tem `type` e `description`; valores por ambiente vêm de `*.tfvars` versionados (sem segredo). Variável sem tipo é bug de configuração latente.
4. **Segredo não entra em `.tf` nem em state legível.** Valores sensíveis vêm de secret manager/variáveis de ambiente e são marcados `sensitive = true`. Lembrar: state guarda valores — segredo hardcoded acaba em texto no state.
5. **Módulos pequenos, versionados, reutilizáveis.** Um módulo faz uma coisa (rede, banco, serviço); fontes externas são pinadas por versão. Módulo gigante é irreversível na revisão.
6. **Providers e core pinados.** `required_version` do Terraform e `required_providers` com versão travada — upgrade de provider é mudança deliberada, não surpresa no próximo `init`.
7. **Naming e tags padronizados.** Todo recurso carrega convenção de nome e tags mínimas (projeto, ambiente, owner) — base de custo, rastreio e limpeza.
8. **Formatado, validado e protegido.** `fmt` e `validate` no CI; recursos críticos (banco de produção, bucket de state) com `prevent_destroy`. Ambientes isolados por workspace OU por diretório — escolha uma e documente.

## Regras verificáveis

- [ ] TF-01: Backend de state remoto com lock configurado (S3+DynamoDB / GCS / HCP Cloud); nenhum state local versionado ou tolerado em time
- [ ] TF-02: Fluxo documentado gera `terraform plan` para revisão humana antes de qualquer `apply`; a automação do framework não roda `apply` nem `destroy`
- [ ] TF-03: Toda `variable` tem `type` e `description`; valores por ambiente em `*.tfvars` versionados
- [ ] TF-04: Nenhum segredo hardcoded em `.tf`/`.tfvars`; valores sensíveis marcados `sensitive = true` e originados de secret manager/env
- [ ] TF-05: Módulos são pequenos e de responsabilidade única; módulos externos referenciados com versão pinada
- [ ] TF-06: `required_version` (Terraform core) e `required_providers` com versões travadas presentes
- [ ] TF-07: Todo recurso segue a convenção de nomes do projeto e recebe as tags mínimas (projeto, ambiente, owner)
- [ ] TF-08: `terraform fmt -check` e `terraform validate` rodam no CI e são gate do merge
- [ ] TF-09: Isolamento de ambientes por workspaces OU por diretórios — a escolha está feita e documentada (não misturar as duas)
- [ ] TF-10: `outputs` mínimos e úteis (o que outro módulo/consumidor realmente precisa); sem despejar recurso inteiro
- [ ] TF-11: Recursos críticos (banco/bucket de state/dados de produção) com `lifecycle { prevent_destroy = true }`
- [ ] TF-12: `terraform init` reproduzível — `.terraform.lock.hcl` commitado para travar os hashes dos providers

## Antipadrões

| Antipadrão | Por que é ruim | O que fazer |
|---|---|---|
| State local (`terraform.tfstate` no repo/máquina) | Dois `apply` concorrentes corrompem; segredo vaza no disco | Backend remoto com lock (TF-01) |
| Automação que roda `apply` sozinha | Mudança de infra sem revisão humana; incidente autoinfligido | Gerar `plan`, revisar, humano aplica (TF-02) |
| `variable "x" {}` sem tipo/descrição | Configuração ambígua; erro só aparece no `apply` | `type` + `description` obrigatórios (TF-03) |
| Senha/token literal no `.tf` | Vaza no repo E no state em texto claro | Secret manager + `sensitive = true` (TF-04) |
| Provider sem versão (`~>` ausente) | `init` puxa versão nova e o `plan` muda sozinho | `required_providers` pinado + lockfile (TF-06/TF-12) |
| Módulo monolito de 800 linhas | Impossível revisar; blast radius enorme | Módulos pequenos, responsabilidade única (TF-05) |
| Recurso sem tags | Custo não rastreável; ninguém sabe o dono | Naming + tags padrão em todo recurso (TF-07) |
| Banco de produção sem `prevent_destroy` | Um `destroy` errado apaga dados irrecuperáveis | `lifecycle { prevent_destroy = true }` (TF-11) |

## Exemplo esquemático (pin + variável + proteção)

```hcl
terraform {
  required_version = "~> 1.9"
  required_providers { aws = { source = "hashicorp/aws", version = "~> 5.60" } }
  backend "s3" { bucket = "tf-state-projeto"; key = "prod/terraform.tfstate"; dynamodb_table = "tf-lock" }
}
variable "db_password" { type = string; description = "Senha do banco (via secret manager)"; sensitive = true }
resource "aws_db_instance" "main" {
  tags      = { project = "supernova", env = "prod", owner = "plataforma" }
  lifecycle { prevent_destroy = true }
}
```

## Como o plano de deploy especializa

O `specs/DEPLOY.md` do projeto deve definir concretamente:

- O backend de state real (provedor, bucket/tabela de lock, chave por ambiente) e como as credenciais desse backend são obtidas
- A estratégia de ambientes escolhida (workspaces vs diretórios `envs/<env>/`) e a estrutura de pastas dos módulos e composições
- O secret manager de origem dos valores sensíveis (AWS Secrets Manager, GCP Secret Manager, Vault) e o mapeamento variável → segredo
- A convenção de naming e o conjunto exato de tags obrigatórias, além dos providers e versões pinadas para a nuvem-alvo
- O fluxo operacional de `plan`/`apply` (quem revisa, onde o `plan` é publicado, quem tem permissão de aplicar) — reforçando que a automação para no `plan`
