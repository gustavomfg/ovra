---
name: OVRA — UMBRA
description: Uma presença de sombra no vazio; a obra ocupa a tela e a interface acompanha em silêncio.
colors:
  void: "#040305"
  shell-void: "#030304"
  ink: "#ece8e1"
  muted: "#8d8a85"
  ember: "#dc638c"
  magenta-bounce: "#b64972"
  pale-light: "#d4cddd"
  violet-light: "#a596b5"
  shadow: "#29232e"
  tatter: "#332b39"
  obsidian: "#2a2431"
  bone: "#c3afb8"
typography:
  wordmark:
    fontFamily: '"Inter Tight", "Helvetica Neue", Arial, sans-serif'
    fontSize: "13px"
    fontWeight: 500
    letterSpacing: "0.42em"
  index:
    fontFamily: '"IBM Plex Mono", ui-monospace, monospace'
    fontSize: "11px"
    fontWeight: 400
    letterSpacing: "0.12em"
  label:
    fontFamily: '"IBM Plex Mono", ui-monospace, monospace'
    fontSize: "10px"
    fontWeight: 400
    letterSpacing: "0.12em"
  control:
    fontFamily: '"IBM Plex Mono", ui-monospace, monospace'
    fontSize: "10px"
    fontWeight: 400
    letterSpacing: "0.08em"
rounded:
  none: "0"
  circle: "50%"
spacing:
  edge: "32px"
  compact-edge: "22px"
  stack: "12px"
components:
  wordmark:
    textColor: "{colors.ink}"
    typography: "{typography.wordmark}"
  experiment-link:
    textColor: "{colors.muted}"
    typography: "{typography.index}"
  experiment-link-current:
    textColor: "{colors.ink}"
  entity-caption:
    textColor: "{colors.ink}"
    typography: "{typography.label}"
  state-readout:
    textColor: "{colors.muted}"
    typography: "{typography.label}"
  state-dot:
    backgroundColor: "{colors.ember}"
    rounded: "{rounded.circle}"
    width: "3px"
    height: "3px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.control}"
    rounded: "{rounded.none}"
    padding: "0 2px"
  button-quiet-hover:
    textColor: "{colors.ink}"
  button-quiet-pressed:
    textColor: "{colors.ink}"
---

# Design System: OVRA — UMBRA

## Overview

**Creative North Star: "Presença no vazio"**

OVRA oferece uma obra interativa em tela inteira. UMBRA é uma criatura de sombra: sobrancelha em V ligada à coroa angular, olhos magenta inclinados, sorriso de presas, garras articuladas e matéria que termina em tecido rasgado. A referência fornecida pelo autor orienta a identidade; o resultado é uma interpretação 3D estilizada.

A escuridão deixa o olhar e a silhueta conduzirem a atenção. Marca, índice, título, estado e controles ficam nas bordas, com texto curto em português. O ambiente da criatura é um fundo escuro isolado, sem lua, ruínas ou cidade.

**Key Characteristics:**

- Silhueta completa e espaço escuro ao redor.
- Matéria grafite violeta, luz localizada e pupilas legíveis.
- Atenção e postura conduzem o movimento.
- Tipografia pequena, controles discretos e foco visível.
- Movimento reduzido, áudio opcional e alternativa 2D preservam o acesso à obra.

## Colors

Magenta pontual atravessa uma base quase preta e materiais de violeta dessaturado.

### Primary

- **Brasa magenta** (`ember`): ponto de estado e seleção de texto. Os olhos têm um gradiente emissivo próprio, com centro luminoso e pupila escura; a cor viva permanece localizada no olhar e na pequena gema.
- **Reflexo magenta** (`magenta-bounce`): luz ambiente inferior fraca, que acompanha a emissão localizada sem tingir a interface.

### Secondary

- **Luz violeta pálida** (`pale-light`): faixa clara do ambiente de iluminação, que revela o contorno e o volume.
- **Luz violeta suave** (`violet-light`): preenchimento do ambiente que separa as camadas de matéria escura. Esses tons pertencem à iluminação 3D, sem criar superfícies coloridas na interface.

### Neutral

- **Vazio violeta** (`void`): fundo da cena e da alternativa 2D.
- **Vazio da interface** (`shell-void`): base do documento, carregamento e cortina.
- **Tinta clara** (`ink`): marca, título, navegação atual e controles em foco de atenção.
- **Cinza silencioso** (`muted`): estado, sufixo do título e controles em repouso.
- **Sombra grafite** (`shadow`): rosto, corpo e partes rígidas com reflexos violetas suaves.
- **Tecido escuro** (`tatter`): matéria rasgada, mais fosca que o corpo.
- **Obsidiana** (`obsidian`): lâminas da coroa e garras com reflexos mais definidos.
- **Osso rosado** (`bone`): presas que tornam o sorriso legível sem competir com os olhos.

**The Olhar Rule.** A luz emissiva mantém a pupila escura e a forma inclinada do olho legíveis; o brilho não deve apagar a anatomia.

## Typography

**Display Font:** Inter Tight, com Helvetica Neue, Arial e sans-serif como alternativas.
**Label/Mono Font:** IBM Plex Mono, com ui-monospace e monospace como alternativas.

Inter Tight dá presença à marca espaçada. IBM Plex Mono trata o restante do texto como uma leitura discreta da obra. Não há uma escala de títulos promocionais ou blocos de texto na experiência atual.

### Hierarchy

- **Marca:** peso médio, letras maiúsculas e espaçamento amplo; usa o papel `wordmark`.
- **Índice:** código do experimento, alinhado à direita; usa o papel `index`.
- **Título e estado:** informação curta no rodapé; usam o papel `label`. O título passa a 9 px na composição compacta.
- **Controles:** palavras em caixa baixa; usam o papel `control`.

**The Voz Baixa Rule.** O texto descreve identidade, estado ou ação disponível; sua escala permanece subordinada à criatura.

## Layout

A obra ocupa a largura e a altura do viewport. A marca fica no canto superior esquerdo e o índice no superior direito. Título e estado ficam no inferior esquerdo; os dois controles ocupam o inferior direito. As margens laterais seguem `edge`, com cabeçalho a 26 px do topo e respeito às áreas seguras no rodapé.

Até 700 px de largura, as margens seguem `compact-edge`. O título sobe para 78 px da base, e os controles se distribuem nos dois lados, a pelo menos 16 px da base. O enquadramento recua em telas estreitas para manter coroa, mãos e tecido dentro da imagem. A tela não cria uma coluna de conteúdo nem uma rolagem de página.

**The Silhueta Rule.** O enquadramento preserva a leitura conjunta da coroa, do rosto, das garras e da cauda de tecido, com espaço para a resposta da criatura.

## Elevation & Depth

A interface é plana, sem sombras de caixas, painéis ou superfícies de vidro. A profundidade vem do volume 3D: luz lateral e de contorno, sombras do próprio modelo, reflexos de obsidiana e contraste entre corpo e tecido. Mapas de normal e rugosidade sustentam a textura; névoa esparsa acompanha o corpo sem esconder seu contorno. Bloom restrito mantém os olhos e a gema vivos.

## Shapes

A interface usa texto sem molduras; o único elemento circular é o ponto de estado. O foco desenha um contorno fino ao redor do alvo interativo. A criatura combina uma cabeça larga, sobrancelha angular contínua, cristas desiguais enraizadas no rosto, presas individuais e garras curvas. A capa abre em tiras com rasgos e vazios reais, e o corpo termina em tecido irregular. Essas formas pertencem ao personagem e preservam sua assimetria.

## Components

### Navigation

Marca fixa e índice mínimo. O código atual e o hover usam tinta clara; os demais estados usam cinza silencioso. Links têm área mínima de 44 × 44 px e o experimento atual usa `aria-current="page"`.

### Caption and state

O título identifica ENTITY 002 — UMBRA. O nome UMBRA usa cinza silencioso. A linha de estado aparece abaixo, com ponto magenta, intervalo de 9 px e anúncio educado por `aria-live="polite"`. A leitura muda junto com a atenção e o temperamento da criatura.

### Quiet controls

Botões de texto transparentes, sem borda, com altura mínima de 44 px. Hover e estado pressionado clareiam o texto; o estado desativado reduz a opacidade para 0,4. O foco visível usa contorno de 1 px em tinta clara, afastado 6 px.

`provocar` oferece pelo teclado a mesma resposta do toque na obra: uma preparação curta, pequeno movimento de cabeça e mãos e retorno demorado. `som off/on` controla o áudio opcional, desligado por padrão, e informa seu estado por `aria-pressed`.

### Living presence

Os olhos aparecem antes do corpo; luz de contorno revela a coroa, e a abertura assenta em 9,2 s. O olhar fixa um alvo antes de a cabeça acompanhá-lo. Microssacadas, piscadas irregulares, dedos e tecido dão continuidade discreta ao repouso. Molas com amortecimento crítico preservam a velocidade quando o alvo muda. Respostas usam antecipação e retorno, sem fragmentação da criatura.

Com movimento reduzido, a obra já aparece assentada: câmera, deriva, tecido e perseguição espacial ficam imóveis. Cor e leitura de estado ainda podem responder. Sem WebGL2 ou após falha do contexto, a alternativa 2D usa um pôster renderizado do modelo; se a imagem faltar, olhos e sorriso preservam a presença básica. Título, estado e controles continuam disponíveis.

## Do's and Don'ts

### Do:

- **Do** preservar a silhueta inteira e o espaço escuro ao redor em telas largas e estreitas.
- **Do** reservar o brilho magenta ao olhar, à gema e ao pequeno sinal de estado.
- **Do** manter a pupila legível e distinguir a matéria fosca dos reflexos de obsidiana.
- **Do** dar ao gesto uma preparação, uma resposta contida e um retorno suave.
- **Do** manter foco visível, áreas de toque adequadas, áudio opcional e movimento reduzido.

### Don't:

- **Don't** acrescentar lua, ruínas ou cidade ao ambiente isolado de UMBRA.
- **Don't** transformar os controles em painéis, cartões ou blocos de texto.
- **Don't** usar partículas dispersas ou uma explosão de fragmentos como resposta da criatura.
- **Don't** deixar bloom ou névoa esconderem as pupilas, as presas ou o contorno das garras.
- **Don't** disparar áudio automaticamente.
