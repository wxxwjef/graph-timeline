import { useCallback, useContext, useEffect, useMemo } from 'react';
import { useSafeState } from 'ahooks';
import type { BaseType, Selection } from 'd3-selection';
import GraphContext from '../context';
import type { IEdge, IEdgeTypeStyle, INode, INodeTypeStyle } from '../types';
import { compileColor, formatTime } from '../utils';

export interface IProps {
  xScale: any;
  yScale: any;
}

export default ({ xScale, yScale }: IProps) => {
  const {
    wrapper,
    edges = [],
    nodes = [],
    size,
    xAxisStyle,
    yAxisStyle: { width: yWidth },
    getCurrNodeStyle,
    getCurrEdgeStyle
  } = useContext(GraphContext);

  const [chart, setChart] = useSafeState<Selection<BaseType, null, BaseType, unknown>>();

  useEffect(() => {
    if (!wrapper) return;
    // init chart Element
    let chart = wrapper.select('svg').selectAll('g.__chart').data([null]);
    const chartEnter: any = chart.enter().append('g').attr('class', '__chart');
    chart = chart.merge(chartEnter);
    setChart(chart);

    // init gradient defs
    wrapper.select('svg').selectAll('defs.__gradient')
        .data([null])
        .enter()
        .append('defs')
        .attr('class', '__gradient')
  }, [wrapper]);

  const nodesMap = useMemo(() => {
    const m: Record<string, INode> = {};
    nodes.forEach((node) => {
      m[node.id] = node;
    });
    return m;
  }, [nodes]);

  const insertGradient = useCallback((startColor: string, endColor: string, gradientReverse: boolean = false) => {
    if (!wrapper) return;
    const startCompileColor = compileColor(startColor);
    const endCompileColor = compileColor(endColor);

    let id = [startCompileColor, endCompileColor];
    if (gradientReverse) id.push('r');
    const gradientId = id.join('_')

    const defs = wrapper.select('defs.__gradient');
      
    if (defs.select(`#${gradientId}`).size()) return gradientId;

    let gradient = defs.insert('linearGradient')
        .attr('id', gradientId)
        .attr('gradientUnits', 'userSpaceOnUse')


    if (!gradientReverse) {
      // 正向渐变：start -> end
      gradient = gradient.attr('x2', "0%")
            .attr('y2', '100%')
    } else {
      // 反向渐变： end -> start
      gradient = gradient.attr('x1', "100%")
            .attr('y1', '100%')
    }

    gradient.selectAll('stop')
        .data([
          {color: startColor, offset: "5%"},
          {color: endColor, offset: "95%"}
        ])
        .enter()
        .append('stop')
        .attr('offset', d => d.offset)
        .attr('stop-color', d => d.color);
    
    return gradientId;
  }, [wrapper])

  useEffect(() => {
    if (!chart || !size) return;
    // start 节点
    const start = chart
      .selectAll('.__circle.__start')
      .data(
        edges
          .filter((edge) => !!(edge.start && nodesMap[edge.start]))
          .filter(
            (edge) =>
              xScale(formatTime(edge.properties.createdTime)) >= yWidth &&
              xScale(formatTime(edge.properties.createdTime)) <= size.width,
          ),
      );
    const startEnter: any = start.enter().append('circle').attr('class', '__circle __start');

    start
      .merge(startEnter)
      .attr('r', (edge: IEdge) => {
        const node = nodesMap?.[edge.start];
        return getCurrNodeStyle?.('radius', node) || null;
      })
      .attr('fill', (edge: IEdge) => {
        const node = nodesMap?.[edge.start];
        return getCurrNodeStyle?.('color', node) || null;
      })
      .attr('cx', (edge: IEdge) => {
        return xScale(formatTime(edge.properties.createdTime));
      })
      .attr('cy', (edge: IEdge) => {
        return yScale(edge.start);
      });
    start.exit().remove();

    // end 节点（有 end 才绘制，如果没有就不绘制）
    const end = chart
      .selectAll('.__circle.__end')
      .data(
        edges
          .filter((edge) => !!(edge.end && nodesMap[edge.end]))
          .filter(
            (edge) =>
              xScale(formatTime(edge.properties.createdTime)) >= yWidth &&
              xScale(formatTime(edge.properties.createdTime)) <= size.width,
          ),
      );
    const endEnter: any = end.enter().append('circle').attr('class', '__circle __end');

    end
      .merge(endEnter)
      .attr('r', (edge: IEdge) => {
        const node = nodesMap?.[edge.end];
        return getCurrNodeStyle?.<INodeTypeStyle['radius']>('radius', node) || null;
      })
      .attr('fill', (edge: IEdge) => {
        const node = nodesMap?.[edge.end];
        return getCurrNodeStyle?.('color', node) || null;
      })
      .attr('cx', (edge: IEdge) => {
        return xScale(formatTime(edge.properties.createdTime));
      })
      .attr('cy', (edge: IEdge) => {
        return yScale(edge.end);
      });
    end.exit().remove();

    // 连线（有 start & end 的才画线&在范围内）
    const line = chart
      .selectAll('.__line')
      .data(
        edges
          .filter(
            (edge) => !!(edge.end && edge.start && nodesMap[edge.start] && nodesMap[edge.end]),
          )
          .filter(
            (edge) =>
              xScale(formatTime(edge.properties.createdTime)) >= yWidth &&
              xScale(formatTime(edge.properties.createdTime)) <= size.width,
          ),
      );
    const lineEnter: any = line.enter().append('line').attr('class', '__line');

    line
      .merge(lineEnter)
      .attr('x1', (edge: IEdge) => {
        return xScale(formatTime(edge.properties.createdTime));
      })
      .attr('y1', (edge: IEdge) => {
        return yScale(edge.start);
      })
      .attr('x2', (edge: IEdge) => {
        return xScale(formatTime(edge.properties.createdTime));
      })
      .attr('y2', (edge: IEdge) => {
        return yScale(edge.end);
      })
      .attr('stroke', (edge: IEdge) => {
        const stroke = getCurrEdgeStyle?.('color', edge) || null;
        if (stroke && stroke !== 'gradient') return stroke;

        // 默认配置：渐变
        const gradientReverse = getCurrEdgeStyle?.<IEdgeTypeStyle['gradientReverse']>('gradientReverse', edge);
        const startNode = nodesMap?.[edge.start];
        const endNode = nodesMap?.[edge.end];
        
        const startColor = getCurrNodeStyle?.('color', startNode);
        const endColor = getCurrNodeStyle?.('color', endNode);

        // 其中一个不存在，就使用某个定点的配色;
        if (!startColor || !endColor) return startColor || endColor || null;
        // 如果起始配色相同，直接使用，不再设置渐变配置；
        if (startColor === endColor) return startColor;

        const gradientId = insertGradient(startColor, endColor, gradientReverse);

        return `url(#${gradientId})`;
      })
      .attr('stroke-width', (edge: IEdge) => {
        const width = getCurrEdgeStyle?.<IEdgeTypeStyle['width']>('width', edge) || null;
        return width;
      })
    line.exit().remove();
  }, [chart, size, xScale, yScale, edges, nodes]);

  return {
    chart,
  };
};
