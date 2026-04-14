import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../constants/config';

interface Message {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  avatar: string;
  unread: boolean;
}

const mockMessages: Message[] = [
  {
    id: '1',
    name: 'Juan Pérez',
    lastMessage: 'Perfecto, mañana a las 10 está bien',
    time: '10:30',
    avatar: '👨',
    unread: true,
  },
  {
    id: '2',
    name: 'María González',
    lastMessage: 'Gracias por la cotización',
    time: 'Ayer',
    avatar: '👩',
    unread: false,
  },
];

const MessagesScreen: React.FC = () => {
  const renderMessage = ({ item }: { item: Message }) => (
    <TouchableOpacity style={styles.messageCard}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.avatar}</Text>
      </View>
      <View style={styles.messageContent}>
        <View style={styles.messageHeader}>
          <Text style={[styles.name, item.unread && styles.nameUnread]}>
            {item.name}
          </Text>
          <Text style={styles.time}>{item.time}</Text>
        </View>
        <Text
          style={[styles.lastMessage, item.unread && styles.lastMessageUnread]}
          numberOfLines={1}
        >
          {item.lastMessage}
        </Text>
      </View>
      {item.unread && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Mensajes</Text>
      </View>

      {/* Messages List */}
      <FlatList
        data={mockMessages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>No tenés mensajes</Text>
            <Text style={styles.emptyDescription}>
              Cuando contactes a un profesional, los verás aquí
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
    padding: SPACING.lg,
    paddingTop: SPACING.xl,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.white,
  },
  listContent: {
    padding: SPACING.md,
    flexGrow: 1,
  },
  messageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  avatarText: {
    fontSize: 24,
  },
  messageContent: {
    flex: 1,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  name: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.gray700,
  },
  nameUnread: {
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.gray900,
  },
  time: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.gray400,
  },
  lastMessage: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray500,
  },
  lastMessageUnread: {
    color: COLORS.gray700,
    fontWeight: FONT_WEIGHT.medium,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primary,
    marginLeft: SPACING.sm,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.gray700,
    marginBottom: SPACING.xs,
  },
  emptyDescription: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray500,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
  },
});

export default MessagesScreen;
