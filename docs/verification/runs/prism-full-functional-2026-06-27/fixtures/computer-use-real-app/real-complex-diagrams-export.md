# Real Complex Diagrams Export

This file verifies that Prism preview and export reuse the same rendered diagram output.

## Mermaid Flowchart

```mermaid
flowchart TD
  A[Draft] --> B{Review}
  B -->|Pass| C[Export]
  B -->|Revise| D[Edit]
  D --> B
  C --> E[HTML]
  C --> F[PDF]
  C --> G[PNG]
  C --> H[DOCX]
```

## PlantUML Relationship

```plantuml
@startuml
skinparam backgroundColor transparent
skinparam defaultFontName "PingFang SC"
skinparam shadowing false
actor Writer
rectangle Prism
database Workspace
Writer --> Prism : edit markdown
Prism --> Workspace : save
Prism --> Writer : preview and export
@enduml
```

## Markmap Mind Map

```markmap
# Prism Export
## Preview parity
### Mermaid
### PlantUML
### Markmap
## Output formats
### HTML
### PDF
### PNG 4x
### DOCX
```

## Local Resource

![Prism local export resource](./assets/local-prism-export-resource.svg)

## Table And Math

| Format | Expected |
| --- | --- |
| HTML | self-contained preview output |
| PDF | no missing diagram nodes |
| PNG | keeps selected 4x scale |
| DOCX | readable in office suites |

Inline math: $a^2 + b^2 = c^2$.

Block math:

$$
ExportQuality = \frac{RenderedNodes}{PreviewNodes}
$$
