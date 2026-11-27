---
title: Shortcodes
---

Positional:

{{< github-badge "opengisch/georama" >}}

Named with options:

{{< github-badge repo="opengisch/QField" color="#333333" textColor="#fafafa" stars="false" forks=false width="216px" height="50" icon="github" >}}

Inline {{< github-badge repo="opengisch/georama" release="no" >}} in a sentence.

Invalid values fall back to defaults:

{{< github-badge repo="opengisch/qfieldcloud" color="red;background:url(x)" height="tall" target="_evil" cacheDuration="10" >}}

Invalid repository renders nothing:

{{< github-badge repo="not a repo" >}}
