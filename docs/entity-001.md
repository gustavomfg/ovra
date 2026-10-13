# ENTITY 001 — AWAKENING

## Identidade preservada

A experiência usa a cápsula/ovo mecânico já modelado no Blender: casca metálica, placas cerâmicas, olho central, núcleo e arcos orbitais. O polish atua sobre movimento, enquadramento e luz; não altera os arquivos GLB nem substitui a entidade.

A rota permanece [`/ovra/#/entity-001`](https://gustavomfg.github.io/ovra/#/entity-001). O modelo cinematic é usado no desktop; o optimized mantém a mesma hierarquia no celular. Consulte [o contrato dos assets](entity-001/integration-guide.md).

## Movimento e presença

- **Olhar:** memória interpolada de cerca de 0,24–0,32 s, antecipação pequena e molas com amortecimento crítico. A hesitação reduz gradualmente a atenção; não congela o controle para depois soltá-lo abruptamente.
- **Corpo e cabeça:** participação do corpo no giro é interpolada. Inclinações, aversão e aproximação usam amplitudes pequenas, sem snapping ou tremor artificial.
- **Idle:** o clipe nativo é cíclico e permanece em execução durante as mudanças de humor e a ressonância. A transição `AWAKEN → IDLE` tem mistura suave de 1,2 s.
- **Olho e arcos:** os canais de pálpebras, pupila, íris e giroscópios são retirados dos clipes usados na web. Cada elemento tem um único controle em tempo real. Os giroscópios giram lentamente, com fase contínua.
- **Estados:** o temperamento mantém a memória de tensão. A resposta é deliberada; nenhuma mudança de humor dispara um clipe de recuo ou uma explosão.

| Estado | Leitura visual |
| --- | --- |
| Sonhando | Atenção baixa, pálpebras mais próximas, movimento lento e luz ainda legível. |
| Observando | Olhar atento, pose estável e enquadramento de repouso. |
| Curiosa | Inclinação e aproximação pequenas, olho mais aberto. |
| Recuando | Recuo curto e mudança suave de luz e pose. |
| Alerta | Atenção maior e luz mais fria, com estabilidade do corpo. |
| Perturbada | Distância um pouco maior e atenção reduzida; sem vibração. |
| Indiferente | Desvio de olhar moderado, sem virar abruptamente as costas. |

A calma próxima por 2,3 s conduz à curiosidade. Movimentos próximos acima de 6 unidades da cena por segundo alimentam tensão; a memória decai e a entidade volta a observar. O toque ilumina brevemente o olho, sem empurrar placas.

## Abertura — 11,8 s

O relógio da abertura começa quando o modelo está pronto, evitando trocar a entidade no meio do plano. Se o carregamento falhar ou exceder seis segundos do relógio visível, a representação procedural assume a cena; um modelo que chega atrasado não provoca uma troca brusca.

Contorno, matéria e reconhecimento se sobrepõem. A luz revela volume e mecanismo, enquanto distância, órbita e lente se aproximam do enquadramento final sem inversão de direção. A animação `AWAKEN` acompanha esse relógio.

## Ressonância — 8,8 s

| Passagem | Intervalo | Direção |
| --- | --- | --- |
| Preparação | 0–1,8 s | Pequena contração das placas e recuo de câmera, sem flash. |
| Ressonância | 1,8–4,8 s | Placas abrem até 14% da pose de abertura registrada no modelo. Luz e arcos ganham energia discreta. |
| Quietude | 4,8–5,8 s | A composição respira e permanece legível. |
| Retorno | 5,8–8,8 s | Abertura, iluminação e enquadramento voltam suavemente ao repouso. |

A forma principal permanece intacta. O clipe `TRANSFORM` continua no asset como material autoral, mas não é executado pela experiência. Os caminhos antigos de dispersão, forças de cursor, fragmentação em anéis e mergulho no núcleo foram retirados do runtime.

## Câmera e luz

A câmera de repouso usa distância 16,2 e fov de 28° (lente mais longa, ver `docs/entity-001-research.md`). O rig mantém distância mínima 15,3; no celular, recua conforme a proporção da tela. Framing autoral, humor e parallax têm amortecimento próprio, com offsets discretos.

A emissão é limitada por material, independente da intensidade alta armazenada nos GLB: teto base 1,25 para o sensor, 1,1 para o âmbar e 0,5 para sinais frios, com modulação máxima de 1,05. Key, rim, luz interna e bloom foram reduzidos para preservar o olho e a leitura das superfícies.

Os arcos do modelo são preservados. Anéis procedurais extras aparecem somente na representação procedural. A poeira é atmosférica e esparsa: 420 pontos no desktop e 200 no perfil compacto.

## Gestos e acessibilidade

Segure perto da entidade por 1,25 s, dê um duplo toque ou use o botão nativo `metamorfose`. Soltar, sair da cena, cancelar o gesto ou ocultar a aba encerra a carga. Os dois contatos do duplo toque devem ser próximos e ocorrer dentro de 380 ms.

O som continua opcional. Os botões têm foco visível e o estado é anunciado em `aria-live="polite"`. Com movimento reduzido, câmera e controles espaciais ficam assentados; a sequência especial vira um pulso de luz de 2,4 s.

## Fallback e ciclo de vida

A ausência ou perda de WebGL conduz ao canvas 2D, com a cápsula procedural, olho, arcos e os mesmos controles. Ele compartilha temperamento, percepção e coreografia, sem reorganizar facetas em uma nuvem.

O loop e a narrativa param com a aba oculta, fora da viewport ou com área da cena zerada. A retomada exclui o tempo de pausa. Os controles criticamente amortecidos usam a solução analítica para manter uma resposta consistente entre taxas de quadros.

Cada montagem do personagem clona geometrias e materiais; as texturas embutidas permanecem no cache de carregamento. O descarte não invalida os assets compartilhados. Renderizador, ambiente, pós-processamento, listeners, observadores e linhas do tempo são liberados ao desmontar.

## Organização

`character.ts` preserva e anima o GLB; `scene.ts` reúne luz, câmera e estados; `behavior.ts` e `perception.ts` cuidam da presença; `choreography.ts` e `performance.ts` coordenam o tempo visível. `shards.ts` desenha apenas a casca procedural montada. `EntityFallback.tsx` mantém a interpretação 2D.
