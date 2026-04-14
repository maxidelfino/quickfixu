import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { SPACING } from '../../constants/config';

interface GridProps {
  children: React.ReactNode;
  columns?: number;
  gap?: number;
  style?: ViewStyle;
}

const Grid: React.FC<GridProps> = ({
  children,
  columns = 2,
  gap = SPACING.md,
  style,
}) => {
  return (
    <View style={[styles.grid, { gap }, style]}>
      {React.Children.map(children, (child, index) => (
        <View
          key={index}
          style={[
            styles.gridItem,
            { width: `${100 / columns}%`, paddingRight: gap / 2, paddingLeft: gap / 2 },
          ]}
        >
          {child}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -SPACING.xs,
  },
  gridItem: {
    paddingHorizontal: SPACING.xs,
    marginBottom: SPACING.md,
  },
});

export default Grid;
