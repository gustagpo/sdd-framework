{
  "version": 1,
  "project": {
    "name": "{{PROJECT_NAME}}",
    "specsDir": "specs",
    "frameworkRepo": null
  },
  "stack": {
    "backendProfile": "{{BACKEND_PROFILE}}",
    "frontendProfile": "{{FRONTEND_PROFILE}}",
    "stackFile": "specs/STACK.md"
  },
  "commands": {
    "build:backend": "{{CMD_BUILD_BACKEND}}",
    "test:backend": "{{CMD_TEST_BACKEND}}",
    "test:e2e": "{{CMD_TEST_E2E}}",
    "build:frontend": "{{CMD_BUILD_FRONTEND}}"
  },
  "agents": {
    "team-leader": {
      "subagent": "sdd-team-leader",
      "model": "fable",
      "fallbackModel": "opus",
      "objective": "Pesquisar a fundo e especificar features; consolidar aprendizado ao fechar"
    },
    "ux-ui": {
      "subagent": "sdd-ux-ui",
      "model": "opus",
      "enabled": true
    },
    "dev-backend": {
      "subagent": "sdd-dev-backend",
      "model": "opus"
    },
    "dev-frontend": {
      "subagent": "sdd-dev-frontend",
      "model": "opus",
      "enabled": true
    },
    "qa": {
      "subagent": "sdd-qa",
      "model": "opus"
    },
    "security": {
      "subagent": "sdd-security",
      "model": "opus",
      "participation": "always"
    },
    "devops": {
      "subagent": "sdd-devops",
      "model": "opus",
      "participation": "always"
    }
  },
  "context": {
    "alwaysRead": ["specs/STACK.md"],
    "byAgent": {
      "team-leader": ["specs/STATE.md", "specs/ARCHITECTURE.md", "specs/LESSONS.md"],
      "ux-ui": ["specs/ARCHITECTURE.md"],
      "dev-backend": ["specs/ARCHITECTURE.md", "specs/TESTS.md", "specs/LESSONS.md"],
      "dev-frontend": ["specs/ARCHITECTURE.md", "specs/LESSONS.md"],
      "qa": ["specs/TESTS.md", "specs/LESSONS.md"],
      "security": ["specs/LESSONS.md"],
      "devops": ["specs/ARCHITECTURE.md", "specs/TESTS.md"]
    },
    "lessonsMode": "index"
  },
  "research": {
    "enabled": true,
    "docsDirs": {{DOCS_DIRS_JSON}},
    "openApiSpecs": {{OPENAPI_SPECS_JSON}},
    "webSearch": true
  },
  "gates": {
    "afterStep1": true,
    "afterStep2": true,
    "afterStep3": true
  },
  "conventions": {
    "draftNaming": "drafts/{DOC}.{agent}.md",
    "contractConsolidator": "dev-backend",
    "evaluationConsolidator": "qa",
    "backendOnlyDesign": "skip",
    "maxFixIterations": 3
  },
  "dashboard": {
    "enabled": true,
    "pricingOverrides": {}
  }
}
