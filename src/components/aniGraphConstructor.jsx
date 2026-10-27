import React, { useEffect, useRef } from "react";
import Graph from "graphology";
import Sigma from "sigma";
import forceAtlas2 from 'graphology-layout-forceatlas2';

function Graphrender({userName, listData, sigmaRef, onHoverNode, onNodeClick}) {
  const containerRef = useRef(null);
  const hoverStateRef = useRef({
    hoveredNode: undefined,
    selectedNeighbors: undefined
  });
  const filterStateRef = useRef({
    hiddenFormats: new Set(),
    hideStandalone: false
  });
  const onHoverNodeRef = useRef(onHoverNode);
  const onNodeClickRef = useRef(onNodeClick);

  useEffect(() => {
    onHoverNodeRef.current = onHoverNode;
  }, [onHoverNode]);

  useEffect(() => {
    onNodeClickRef.current = onNodeClick;
  }, [onNodeClick]);

  useEffect(() => {
    if (!containerRef.current) return;
    const graph = new Graph();
    const listIds = new Set(listData.map((anime) => String(anime.id)));
    let sigmaInstance = null;

    // Functions for graphing.
    const setHoveredNode = (node) => {
      if (node) {
        const neighbors = new Set(graph.neighbors(node))
        hoverStateRef.current = {
          hoveredNode: node,
          selectedNeighbors: neighbors,
        };
      } else {
        hoverStateRef.current = {
          hoveredNode: undefined,
          selectedNeighbors: undefined,
        };
      }

      if (onHoverNodeRef.current) onHoverNodeRef.current(node);
      sigmaInstance?.refresh()
    }
    const isNodeFilteredOut = (node, attrs) => {
      if (node === userName) return false;
      const f = filterStateRef.current;
      if (f.hiddenFormats.has(attrs.format)) return true;
      if (f.hideStandalone && attrs.isStandalone) return true;
      return false;
    }
    // For accounts with a lot of completed entries, edges get denser and more visually crowded so a few settings are tweaked to help visibility.
    const nodeCount = listData.length;
    const edgeOpacityScale = nodeCount > 250 ? 0.5 : nodeCount > 120 ? 0.75 : 1;
    const seqPrequelColor = `rgba(56, 189, 248, ${0.6 * edgeOpacityScale})`;
    const otherRelationColor = `rgba(192, 132, 252, ${0.4 * edgeOpacityScale})`;
    const userNodeColor = "#06b6d4";
    const leafNodeColor = "#64748b";
    const hubNodeColor = "#ec4899";

    // Graphing process gets separated into two loops after the user node is created, the first just creates the initial graph, and the second actually maps out the relationships.
    graph.addNode(userName, { label: userName, x: 0, y: 0, size: 14, color: userNodeColor });
    listData.forEach((anime, i) => {
        const angle = (i / listData.length) * 2 * Math.PI;
        const id = String(anime.id);
        graph.addNode(id, { label: anime.title.english || anime.title.romaji, x: Math.cos(angle) * 5, y: Math.sin(angle) * 5, size: 5, color: leafNodeColor, format: anime.format});
    });
    // Second loop.
    listData.forEach((anime) => {
      const id = String(anime.id);
      anime.relations.edges.forEach((relation) => {
        // Checks whether there's any related IDs to that node and the iteration doesn't do anything in case it doesn't.
        const relatedId = String(relation.node.id);
        if (!listIds.has(relatedId)) return;
        // In case it does and an edge for it HASN't been created, then it creates that edge.
        // Has to check that the edge doesn't exist in both directions otherwise we end up with something shows with multiple seasons having both sequel and prequel edges at the same time.
        // Which technically isn't wrong; S1 is the prequel to S2, and S2 is the sequel to S1, but it just makes the graph hard to parse so it's cleaner to just keep one.
        // In any case, hovering on a node shows all the relations between them in a textbox, so those show up that way.
        if (!graph.hasEdge(id, relatedId) && !graph.hasEdge(relatedId, id)) {
          if (relation.relationType === "SEQUEL" || relation.relationType === "PREQUEL"){
            graph.addEdge(id, relatedId, {
              size: 2,
              color: seqPrequelColor,
              label: relation.relationType,
            });
          } else {
            // Relations that aren't sequels/prequels get a smaller edge to show they're less relevant.
            graph.addEdge(id, relatedId, {
              size: 1.5,
              color: otherRelationColor,
              label: relation.relationType
            });
          }
        }
      });
    });

    // Dynamically calculate node size and colors based on connectivity (degree)
    graph.forEachNode((node) => {
      if (node === userName) {
        graph.setNodeAttribute(node, "size", 14);
        graph.setNodeAttribute(node, "color", userNodeColor);
      } else {
        const degree = graph.degree(node);
        const size = Math.min(5 + degree * 1.5, 15);
        graph.setNodeAttribute(node, "size", size);
        graph.setNodeAttribute(node, "isStandalone", degree === 0);

        // Franchise hubs are pink, leaf nodes get the default color.
        const color = degree > 2 ? hubNodeColor : leafNodeColor;
        graph.setNodeAttribute(node, "color", color);
      }
    });

    // Bigger graphs need more room to spread out (higher scalingRatio = more repulsion) and more iterations to actually converge into that spread.
    forceAtlas2.assign(graph, {
      iterations: Math.min(600, Math.max(250, Math.round(nodeCount * 1.2))),
      settings: {
        gravity: nodeCount > 150 ? 0.25 : 0.4,
        scalingRatio: Math.max(12, Math.round(nodeCount * 0.2)),
        strongGravityMode: false,
        linLogMode: true,
      },
    });

    // I still have no idea why I couldn't get Sigma.JS's node hovering functions to work properly (yes I checked the documentation and wrote according to its examples) so I tossed this particular part to an LLM.
    const customDrawNodeHover = (context, data, settings) => {
      const size = settings.labelSize;
      const font = settings.labelFont;
      const weight = settings.labelWeight;
      context.font = `${weight} ${size}px ${font}`;

      context.fillStyle = "#0f172a";
      context.strokeStyle = "#334155";
      context.lineWidth = 1;
      context.shadowOffsetX = 0;
      context.shadowOffsetY = 0;
      context.shadowBlur = 8;
      context.shadowColor = "rgba(0,0,0,0.5)";

      const PADDING = 2;
      if (typeof data.label === "string") {
        const textWidth = context.measureText(data.label).width;
        const boxWidth = Math.round(textWidth + 8);
        const boxHeight = Math.round(size + 2 * PADDING + 2);
        const radius = Math.max(data.size, size / 2) + PADDING;
        const angleRadian = Math.asin(boxHeight / 2 / radius);
        const xDeltaCoord = Math.sqrt(Math.abs(Math.pow(radius, 2) - Math.pow(boxHeight / 2, 2)));

        context.beginPath();
        context.moveTo(data.x + xDeltaCoord, data.y + boxHeight / 2);
        context.lineTo(data.x + radius + boxWidth, data.y + boxHeight / 2);
        context.lineTo(data.x + radius + boxWidth, data.y - boxHeight / 2);
        context.lineTo(data.x + xDeltaCoord, data.y - boxHeight / 2);
        context.arc(data.x, data.y, radius, angleRadian, -angleRadian);
        context.closePath();
        context.fill();
        context.stroke();
      } else {
        context.beginPath();
        context.arc(data.x, data.y, data.size + PADDING, 0, Math.PI * 2);
        context.closePath();
        context.fill();
        context.stroke();
      }
      context.shadowOffsetX = 0;
      context.shadowOffsetY = 0;
      context.shadowBlur = 0;

      if (data.label) {
        context.fillStyle = "#ffffff";
        context.font = `${weight} ${size}px ${font}`;
        context.fillText(data.label, data.x + data.size + 5, data.y + size / 3);
      }
    };

    // The sigmajs renderer is initialized with the styling settings.
    sigmaInstance = new Sigma(graph, containerRef.current, {
      labelColor: {
        color: "#ffffff",
      },
      edgeLabelColor: {
        color: "#dbeafe",
      },
      labelFont: "Arial, sans-serif",
      labelWeight: "normal",
      edgeLabelFont: "Arial, sans-serif",
      edgeLabelWeight: "normal",
      edgeLabelSize: 10,
      defaultDrawNodeHover: customDrawNodeHover,
      enableEdgeClickEvents: true,
      enableEdgeWheelEvents: true,
      enableEdgeHoverEvents: true,
      enableNodeHoverEvents: true,
      renderEdgeLabels: true,
      labelRenderedSizeThreshold: nodeCount > 150 ? 12 : 9,
    });

    // Here are the different functions for focusing and clearing focus from a particular node by assigning it to current.
    sigmaRef.current = {
      focusNode: (nodeId) => {
        if (!sigmaInstance) return; // Checks if the Sigma instance exists first.
        const graphInstance = sigmaInstance.getGraph();
        if (graphInstance && graphInstance.hasNode(nodeId)) {
          // In case it does, grabs the node's neighbors and stores them in a set + the ID of the node.
          const neighbors = new Set(graphInstance.neighbors(nodeId));
          hoverStateRef.current = {
            hoveredNode: nodeId,
            selectedNeighbors: neighbors,
          };
          const nodeDisplayData = sigmaInstance.getNodeDisplayData(nodeId); // Checks its position and animates a little zoom to it when focused on.
          if (nodeDisplayData) {
            const { x, y } = nodeDisplayData;
            sigmaInstance.getCamera().animate(
              { x, y, ratio: 0.15 },
              { duration: 600 }
            );
          }
          if (onHoverNodeRef.current) onHoverNodeRef.current(nodeId); // More checks just to make sure everything is actually loaded.
          sigmaInstance.refresh(); // Refreshes the graph so the hover and neighbor states can be rendered properly.
        }
      },
      clearFocus: () => {
        // Whenever clearing focus, flushes the variables used to indicate a node is being focused on.
        if (!sigmaInstance) return;
        hoverStateRef.current = {
          hoveredNode: undefined,
          selectedNeighbors: undefined,
        };
        if (onHoverNodeRef.current) onHoverNodeRef.current(undefined);
        sigmaInstance.refresh();
      },
      // The function that actually filters the formats (and standalone nodes) the user wants to hide.
      setFilters: (hiddenFormats, hideStandalone) => {
        filterStateRef.current = { hiddenFormats, hideStandalone };
        sigmaInstance?.refresh();
      }
    };
    // Different functions I tried to enable the node hovering/clicking functionality.
    sigmaInstance.on('enterNode', function(e) {
      setHoveredNode(e.node)
    })
    sigmaInstance.on('clickNode', function(e) {
      if (onNodeClickRef.current) onNodeClickRef.current(e.node);
    })
    sigmaInstance.on('leaveNode', function(){
      setHoveredNode(undefined);
    })
    sigmaInstance.on('clickStage', function() {
      setHoveredNode(undefined);
    })
    // The settings that allow me to define how nodes and edges are rendered based on filters and hover states.
    sigmaInstance.setSetting("nodeReducer", (node, data) => {
      // In case the node is filtered out, hide it.
      if (isNodeFilteredOut(node, data)) {
        return {...data, hidden: true};
      }
      // S keeps record of the currently hovered on node, and changes the node to be yellow and makes its neighbors orange.
      const s = hoverStateRef.current;
      if (s.hoveredNode === node){
        return {...data, color: "yellow", size: 10}
      }
      if (s.selectedNeighbors?.has(node)){
        return {...data, color: "orange", size: 10}
      }
      // Dim the other nodes that aren't neighbors of the one that's currently hovered on.
      if (s.hoveredNode) {
        return {...data, color: "#444"}
      }
      return data;
    })
    sigmaInstance.setSetting("edgeReducer", (edge, data) => {
      // Obtain all the edges.
      const [source, target] = graph.extremities(edge);
      // If a filtered node is connected to an edge, hide it.
      if (isNodeFilteredOut(source, graph.getNodeAttributes(source)) || isNodeFilteredOut(target, graph.getNodeAttributes(target))) {
        return { ...data, hidden: true };
      }
      const s = hoverStateRef.current;
      // If no node is hovered on, hide labels for the edges. Helps with visibility.
      if (!s.hoveredNode) {
        return { ...data, label: null };
      }
      // Preserve edges connected to the focused node.
      if (source === s.hoveredNode || target === s.hoveredNode) {
        return data;
      }
      // Hide all unrelated edges.
      return { ...data, hidden: true };
    })
    // Cleanup. Shuts down the Sigma instance.
    return () => {
      sigmaInstance.kill();
      sigmaRef.current = null;
    };
  }, [userName, listData]);

  return (
    // The viewport for the Sigma instance/graph. Takes up the whole screen and is on top of the notebook theming I added.
    <div ref={containerRef} style={{ width: "100%", height: "100%" }} className="z-0"/>
  );
}

export default React.memo(Graphrender, (prevProps, nextProps) => {
  return prevProps.userName === nextProps.userName && prevProps.listData === nextProps.listData;
});
