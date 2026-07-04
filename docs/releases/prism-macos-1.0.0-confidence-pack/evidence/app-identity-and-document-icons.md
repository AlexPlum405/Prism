# App Identity And Document Icon Evidence

> Captured: 2026-07-04 03:13 CST
> Installed app: `/Applications/Prism.app`

## App Identity Command

```bash
plutil -p /Applications/Prism.app/Contents/Info.plist | rg 'CFBundleShortVersionString|CFBundleVersion|CFBundleIdentifier|CFBundleName|CFBundleDisplayName'
```

## App Identity Result

```text
"CFBundleDisplayName" => "Prism"
"CFBundleIdentifier" => "com.prism.editor.v1"
"CFBundleName" => "Prism"
"CFBundleShortVersionString" => "1.0.0"
"CFBundleVersion" => "1.0.0"
```

## Document Type Command

```bash
plutil -extract CFBundleDocumentTypes json -o - /Applications/Prism.app/Contents/Info.plist | jq '.'
plutil -extract UTExportedTypeDeclarations json -o - /Applications/Prism.app/Contents/Info.plist | jq '.'
```

## Document Type Result

Markdown document types:

```json
[
  {
    "CFBundleTypeExtensions": ["md", "markdown"],
    "LSHandlerRank": "Owner",
    "CFBundleTypeName": "Prism Markdown Document",
    "CFBundleTypeIconFile": "PrismMarkdownSignatureDocument",
    "LSItemContentTypes": ["com.prism.editor.markdown"],
    "CFBundleTypeRole": "Editor",
    "CFBundleIconName": "PrismMarkdownSignatureDocument"
  },
  {
    "CFBundleTypeName": "Markdown Document",
    "CFBundleTypeRole": "Editor",
    "LSHandlerRank": "Owner",
    "CFBundleIconName": "PrismMarkdownSignatureDocument",
    "LSItemContentTypes": [
      "net.daringfireball.markdown",
      "public.markdown",
      "net.ia.markdown",
      "com.unknown.md"
    ],
    "CFBundleTypeIconFile": "PrismMarkdownSignatureDocument"
  }
]
```

Text document type:

```json
{
  "CFBundleTypeName": "Prism Text Document",
  "CFBundleTypeExtensions": [
    "txt",
    "text",
    "sql",
    "json",
    "jsonc",
    "yaml",
    "yml",
    "toml",
    "xml",
    "csv",
    "tsv",
    "log",
    "ini",
    "conf",
    "env"
  ],
  "CFBundleTypeRole": "Editor",
  "CFBundleIconName": "PrismTextDocument",
  "LSHandlerRank": "Default",
  "CFBundleTypeIconFile": "PrismTextDocument",
  "LSItemContentTypes": [
    "com.prism.editor.text",
    "public.plain-text",
    "public.text",
    "public.source-code",
    "public.json",
    "public.yaml",
    "public.xml",
    "public.comma-separated-values-text",
    "public.tab-separated-values-text",
    "org.iso.sql"
  ]
}
```

Exported UTIs:

```json
[
  {
    "UTTypeIdentifier": "com.prism.editor.markdown",
    "UTTypeIconFile": "PrismMarkdownSignatureDocument",
    "UTTypeDescription": "Prism Markdown Document",
    "UTTypeConformsTo": ["public.text"],
    "UTTypeTagSpecification": {
      "public.mime-type": ["text/markdown"],
      "public.filename-extension": ["md", "markdown"]
    }
  },
  {
    "UTTypeIdentifier": "com.prism.editor.text",
    "UTTypeIconFile": "PrismTextDocument",
    "UTTypeDescription": "Prism Text Document",
    "UTTypeConformsTo": ["public.text"],
    "UTTypeTagSpecification": {
      "public.mime-type": ["text/plain"],
      "public.filename-extension": [
        "txt",
        "text",
        "sql",
        "json",
        "jsonc",
        "yaml",
        "yml",
        "toml",
        "xml",
        "csv",
        "tsv",
        "log",
        "ini",
        "conf",
        "env"
      ]
    }
  }
]
```

## Release Interpretation

- Markdown and text document icon declarations are present in the installed app.
- Real Finder screenshots show Prism document icons for `.md`, `.markdown`, `.txt`, `.json`, and `.sql`.
- Version metadata is aligned with the 1.0.0 release confidence pack: installed app reports `1.0.0`.
