import React, { useContext } from 'react';
import { select } from 'd3-selection';
import { axisTop } from 'd3-axis';
import { zoom } from 'd3-zoom';
import { useSize, useUpdateEffect } from 'ahooks';
import useXAxis from '../../hooks/useXAxis';
import useYAxis from '../../hooks/useYAxis';
import useChart from '../../hooks/useChart';
import GraphContext from '../../context';

export default () => {
    const {wrapper, size} = useContext(GraphContext)
    const { xScale, xAxis } = useXAxis();
    const { yScale } = useYAxis();
    const { chart } = useChart({
        xScale,
        yScale
    });

    useUpdateEffect(() => {
        if (!wrapper || !size) return;
        // 更新画布大小
        wrapper.selectAll('svg')
                .data([size])
                .attr('width', d => d.width)
                .attr('height', d => d.height);

    }, [wrapper, size])

    useUpdateEffect(() => {
        if (!xScale || !yScale || !xAxis || !wrapper || !size) return;

        const zoomed: any = zoom().on('start', () => {
            console.log('start')
        }).on('zoom', (event) => {
            const rx = event.transform.rescaleX(xScale);

            xAxis.call(axisTop(rx));
        }).on('end', () => {
            console.log('end')
        })

    }, [xScale, yScale, xAxis, wrapper, size])
    return (
        <svg></svg>
    )
}