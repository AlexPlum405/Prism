# Diagrams, formulas, and tasks

Prism keeps technical Markdown readable while preserving the source.

```mermaid
flowchart TD
  Idea[Idea] --> Draft[Markdown Draft]
  Draft --> Preview[Live Preview]
  Preview --> Export[Trusted Export]
```

```plantuml
@startuml
skinparam monochrome false
actor Writer
rectangle Prism {
  Writer --> (Write)
  (Write) --> (Preview)
  (Preview) --> (Export)
}
@enduml
```

```markmap
# Release Plan
## Evidence
### Smoke
### Screenshots
## Package
### macOS
### Windows later
### Linux later
```

The export path should match the screen preview:

$$
confidence = evidence - hidden\\ risk
$$

- [x] Local Markdown opens
- [x] Preview renders diagrams
- [ ] Platform matrix continues after macOS
