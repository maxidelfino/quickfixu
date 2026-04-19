import fs from 'fs';
import path from 'path';

const schemaPath = path.join(__dirname, '../../../prisma/schema.prisma');
const migrationPath = path.join(
  __dirname,
  '../../../prisma/migrations/20260418183000_v1_marketplace_foundation/migration.sql'
);

function readSchema(): string {
  return fs.readFileSync(schemaPath, 'utf8');
}

function expectLine(schema: string, pattern: RegExp): void {
  expect(schema).toMatch(pattern);
}

describe('Prisma marketplace foundation schema', () => {
  it('declares the canonical V1 marketplace enums', () => {
    const schema = readSchema();

    expect(schema).toContain('enum RequestStatus');
    expect(schema).toContain('draft');
    expect(schema).toContain('receiving_proposals');
    expect(schema).toContain('in_coordination');

    expect(schema).toContain('enum ProposalStatus');
    expect(schema).toContain('withdrawn');

    expect(schema).toContain('enum AppointmentStatus');
    expect(schema).toContain('pending_completion_confirmation');

    expect(schema).toContain('enum RequestMediaType');
    expect(schema).toContain('image');
    expect(schema).toContain('video');

    expect(schema).toContain('enum AppointmentCancellationActor');
    expect(schema).toContain('professional');
    expect(schema).toContain('system');
  });

  it('declares requests, proposals, and appointments with canonical completion-confirmation fields', () => {
    const schema = readSchema();

    expect(schema).toContain('model Request {');
    expect(schema).toContain('@@map("requests")');
    expectLine(schema, /status\s+RequestStatus/);
    expectLine(schema, /categories\s+RequestCategory\[\]/);
    expectLine(schema, /media\s+RequestMedia\[\]/);
    expectLine(schema, /proposals\s+Proposal\[\]/);
    expectLine(schema, /appointments\s+Appointment\[\]/);

    expect(schema).toContain('model RequestCategory {');
    expect(schema).toContain('@@map("request_categories")');

    expect(schema).toContain('model RequestMedia {');
    expectLine(schema, /mediaType\s+RequestMediaType/);
    expect(schema).toContain('@@map("request_media")');

    expect(schema).toContain('model Proposal {');
    expectLine(schema, /priceReference\s+Decimal/);
    expectLine(schema, /status\s+ProposalStatus/);
    expect(schema).not.toContain('paymentStatus');
    expect(schema).not.toContain('subscription');

    expect(schema).toContain('model Appointment {');
    expectLine(schema, /status\s+AppointmentStatus/);
    expectLine(schema, /clientConfirmedCompletionAt\s+DateTime\?/);
    expectLine(schema, /professionalConfirmedCompletionAt\s+DateTime\?/);
    expectLine(schema, /completedAt\s+DateTime\?/);
    expectLine(schema, /cancelledBy\s+AppointmentCancellationActor\?/);
    expectLine(schema, /proposalId\s+Int\s+@unique/);
    expect(schema).toContain('@@map("appointments")');
  });

  it('ships a SQL migration for the first marketplace foundation batch', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);

    const migration = fs.readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('CREATE TYPE "RequestStatus"');
    expect(migration).toContain('CREATE TABLE "requests"');
    expect(migration).toContain('CREATE TABLE "request_categories"');
    expect(migration).toContain('CREATE TABLE "request_media"');
    expect(migration).toContain('CREATE TABLE "proposals"');
    expect(migration).toContain('CREATE TABLE "appointments"');
    expect(migration).toContain('price_reference');
    expect(migration).toContain('client_confirmed_completion_at');
    expect(migration).not.toContain('payment');
    expect(migration).not.toContain('subscription');
  });
});
