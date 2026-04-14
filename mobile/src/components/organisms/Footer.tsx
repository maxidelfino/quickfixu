import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '../../constants/config';

interface FooterLink {
  label: string;
  onPress: () => void;
  highlighted?: boolean;
}

interface FooterProps {
  text?: string;
  links?: FooterLink[];
  style?: ViewStyle;
}

const Footer: React.FC<FooterProps> = ({ text, links, style }) => {
  return (
    <View style={[styles.container, style]}>
      {text && (
        <Text style={styles.text}>
          {text}
          {links && links.length > 0 && ' '}
          {links?.map((link, index) => (
            <React.Fragment key={index}>
              <TouchableOpacity onPress={link.onPress} activeOpacity={0.7}>
                <Text
                  style={[
                    styles.link,
                    link.highlighted && styles.linkHighlighted,
                  ]}
                >
                  {link.label}
                </Text>
              </TouchableOpacity>
              {index < links.length - 1 && <Text style={styles.text}> o </Text>}
            </React.Fragment>
          ))}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  text: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray600,
    textAlign: 'center',
  },
  link: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.medium,
  },
  linkHighlighted: {
    fontWeight: FONT_WEIGHT.semibold,
  },
});

export default Footer;
