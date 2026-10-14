# ENTITY 002 — UMBRA

O único experimento ativo do OVRA. Uma criatura de sombra flutua sobre um fundo escuro, observa o visitante e responde com postura, olhar e garras. A referência é a imagem fornecida nesta tarefa; a escolha de cenário foi **personagem isolado**, sem lua ou arquitetura.

![UMBRA no navegador](../images/ovra-entity-002.png)

## Construção do personagem

O modelo existente foi refinado pelo pipeline Blender do projeto. A máscara larga tem cavidades para os olhos e a boca, um arco angular sobre as órbitas e placas que continuam da testa até a coroa. Cristas desiguais e lâminas nas têmporas definem a silhueta. Dentes intercalados, escamas nas bochechas, um pequeno cristal no peito, braços revestidos e dez garras articuladas completam a figura. A matéria inferior forma um volume contínuo, com camadas rasgadas, uma cauda curva e recortes modelados na capa.

É uma interpretação 3D estilizada da ilustração. A profundidade, o verso e partes ocultas são decisões autorais; a imagem única não define uma geometria completa. O resultado utiliza geometria verdadeira e pode ser observado de outros ângulos.

- Fonte editável: `assets/source/entity-002/umbra.blend`.
- Referência fornecida: `assets/source/entity-002/reference.png` (fora dos arquivos públicos).
- Assets web: `public/3d/entity-002/umbra-cinematic.glb` e `umbra-optimized.glb`.
- Texturas: mapas determinísticos de normal e rugosidade de 512 × 512, incorporados aos GLB e conservados na pasta de fonte. A rugosidade e o relevo variam; vértices de tecido guardam pesos de movimento, não cor de superfície.

A máscara e os espinhos usam grafite violeta, reflexos contidos e planos facetados. As superfícies absorvem a maior parte da luz; uma key lateral e um rim frio separam suas camadas. Olhos e cristal concentram o magenta. Não há emissão generalizada sobre a capa nem branco estourado nos olhos.

## Movimento e interação

A abertura dura **9,2 segundos**. Os olhos aparecem primeiro; o contorno revela a coroa, e depois a luz alcança a matéria. A câmera faz uma aproximação contínua e pequena.

O olho conduz a atenção com sacadas, perseguição suave e microssacadas; a cabeça segue com atraso e molas com amortecimento crítico. Piscadas têm intervalos irregulares. O corpo flutua lentamente, os dedos flexionam, a capa tem movimento leve preso às raízes e algumas mechas de névoa acompanham a figura.

| Gesto / situação | Resposta |
| --- | --- |
| Cursor lento perto do rosto | Atenção e curiosidade; a mão do lado do visitante se aproxima |
| Passagens rápidas repetidas | Recuo, tensão e afastamento temporário do olhar |
| Ausência do visitante | Quietude e atenção ociosa |
| Clique ou botão `provocar` | Resposta com antecipação de 0,65 s, pequena inclinação e retorno gradual |
| Botão `som` | Ambiência opcional em Web Audio; desligada por padrão |

Não há enxame, explosão de fragmentos ou reorganização caótica. Cada controle tem uma única autoridade; as poses são calculadas a partir do repouso, sem acumular rotação entre quadros.

## Câmera e acabamento

Repouso: distância 20,8, fov de 34°, órbita de 0,085 rad e distância mínima de 18,5. Em telas estreitas há recuo adicional de 15%, além da correção de proporção do rig, para preservar a silhueta.

ACES, bloom de intensidade baixa, antialiasing e grão discreto. Sem aberração cromática. Uma sombra direcional ajuda a ler a sobreposição entre placas. A névoa é estilizada e instanciada; não é uma simulação física de fumaça.

## Execução e acessibilidade

- O caminho `/ovra/` e o roteamento por hash permanecem compatíveis com GitHub Pages. URLs antigas abrem UMBRA.
- Renderização e relógio da cena param com a aba oculta ou fora da viewport.
- `prefers-reduced-motion` elimina intro, movimento espacial, perseguição do cursor, tecido e câmera móvel. Mantém a pose e os controles.
- Falha de asset ou perda de WebGL2 abre o modo essencial: uma imagem renderizada do próprio modelo, com deslocamento mínimo quando permitido. Se ela não carregar, olhos e sorriso são desenhados em canvas 2D.
- O botão `provocar` oferece acesso por teclado à reação do clique. Áudio requer ação explícita.
- Cada montagem possui suas geometrias e materiais; as texturas compartilhadas do cache continuam válidas. Descarte é idempotente.

## Reproduzir os assets

```bash
blender -b --factory-startup --python tools/blender/entity-002/build_umbra.py -- cinematic optimized
python3 tools/blender/entity-002/validate_asset.py
```

`surface_textures.py` gera os mapas sem dependências externas ao Blender. O validador verifica controles, orçamento de triângulos/bytes, UVs, pesos de tecido e texturas incorporadas. Os GLB exportam o rig de controles; a animação da experiência é feita em tempo real por `creature.ts`, sem clipes concorrentes.

As medições do validador são de asset. Não constituem uma promessa de FPS: o desempenho depende da GPU, resolução e navegador.

## Referências técnicas consultadas

- [Materiais físicos do Three.js](https://threejs.org/docs/pages/MeshPhysicalMaterial.html): clearcoat, sheen e resposta ao ambiente. Esses recursos são usados com intensidades pequenas; a forma e a luz conduzem a leitura.
- [Geometria de curvas no Blender](https://docs.blender.org/manual/en/2.90/modeling/curves/properties/geometry.html): princípios de perfil e afunilamento. O pipeline autoral constrói curvas Bézier e suas superfícies diretamente em malhas.
