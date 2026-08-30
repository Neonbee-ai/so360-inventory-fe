/**
 * BDD specs: Inventory master-data text rules (frontend half).
 *
 * These mirror so360-inventory-be/src/common/validation/business-text.validator.spec.ts.
 * Both suites are fed the same production strings — `)*&(^`, `_( )*_`,
 * `((^*&%`, `@@@@`, `#####` — so the two halves cannot drift into disagreeing
 * about what counts as valid master data.
 */

import { describe, it, expect } from 'vitest';
import {
    firstError,
    isClean,
    optional,
    validateAddress,
    validateBarcode,
    validateCode,
    validateName,
    validatePersonName,
    validatePhone,
    validatePlaceName,
    validateReference,
    validateSku,
    hasBalancedParens,
} from './validators';

describe('Given hasBalancedParens', () => {
    it.each(['no parens', '(a)', 'a (b) c (d)'])(
        'Given the balanced value %s / When checked / Then true',
        (value) => expect(hasBalancedParens(value)).toBe(true),
    );

    it.each(['((', '))', ')(', 'a (b'])(
        'Given the unbalanced value %s / When checked / Then false',
        (value) => expect(hasBalancedParens(value)).toBe(false),
    );
});

const SYMBOL_SOUP = [')*&(^', '_( )*_', '((^*&%', '@@@@', '#####', '---', '***'];

describe('Given validateName', () => {
    it.each(['Dubai South Hub', 'Raw Material Rack A', 'Steel Cabinet & Co.', 'Aisle-01'])(
        'Given the business name %s / When validated / Then no message',
        (value) => {
            expect(validateName(value, 'Warehouse Name')).toBeNull();
        },
    );

    it('Given a blank value / When validated / Then it reports the field as required', () => {
        expect(validateName('', 'Warehouse Name')).toBe('Warehouse Name is required.');
        expect(validateName('   ', 'Warehouse Name')).toBe('Warehouse Name is required.');
    });

    it('Given fewer than the minimum characters / When validated / Then it states the minimum', () => {
        expect(validateName('AB', 'Warehouse Name')).toBe(
            'Warehouse Name must contain at least 3 characters.',
        );
    });

    it('Given a lowered minimum / When validated / Then two characters pass', () => {
        expect(validateName('A1', 'Location Name', 2)).toBeNull();
    });

    it('Given more than the maximum characters / When validated / Then it states the maximum', () => {
        expect(validateName('A'.repeat(101), 'Warehouse Name')).toBe(
            'Warehouse Name must be 100 characters or fewer.',
        );
    });

    it('Given a numeric-only name / When validated / Then it demands letters', () => {
        expect(validateName('123456', 'Item Name')).toBe(
            'Item Name must contain letters, not only numbers or symbols.',
        );
    });

    it('Given balanced parentheses / When validated / Then no message', () => {
        expect(validateName('Office Chair (Black)', 'Item Name')).toBeNull();
    });

    it.each(['OIU((T', 'Chair (Black', 'Chair Black)'])(
        'Given the unbalanced parentheses in %s / When validated / Then it reports invalid characters',
        (value) => {
            expect(validateName(value, 'Item Name')).toBe(
                'Item Name contains invalid characters.',
            );
        },
    );

    it.each(SYMBOL_SOUP)(
        'Given the symbol-only name %s / When validated / Then it is rejected',
        (value) => {
            expect(validateName(value, 'Warehouse Name')).not.toBeNull();
        },
    );

    it('Given a disallowed character / When validated / Then it reports invalid characters', () => {
        expect(validateName('Zone <A>', 'Warehouse Name')).toBe(
            'Warehouse Name contains invalid characters.',
        );
    });
});

describe('Given validateCode', () => {
    it.each(['DXB-01', 'RM-01', 'BIN_A01'])(
        'Given the code %s / When validated / Then no message',
        (value) => {
            expect(validateCode(value, 'Short Code', 3, 15)).toBeNull();
        },
    );

    it('Given a blank value / When validated / Then it reports the field as required', () => {
        expect(validateCode('', 'Short Code')).toBe('Short Code is required.');
    });

    it('Given too few characters / When validated / Then it states the minimum', () => {
        expect(validateCode('AB', 'Short Code', 3, 15)).toBe(
            'Short Code must contain at least 3 characters.',
        );
    });

    it('Given too many characters / When validated / Then it states the maximum', () => {
        expect(validateCode('A'.repeat(16), 'Short Code', 3, 15)).toBe(
            'Short Code must be 15 characters or fewer.',
        );
    });

    it.each(['@@@@', '#####', '---'])(
        'Given the symbol-only code %s / When validated / Then it says symbols alone are not allowed',
        (value) => {
            expect(validateCode(value, 'Location Code', 2, 20)).toBe(
                'Location Code cannot contain only special characters.',
            );
        },
    );

    it('Given a code with a space / When validated / Then it lists the allowed characters', () => {
        expect(validateCode('DXB 01', 'Short Code', 3, 15)).toBe(
            'Short Code may contain only letters, numbers, hyphens and underscores.',
        );
    });
});

describe('Given validateReference', () => {
    it.each(['PO-1001', 'INV-0234', 'GRN-00012', 'Acme Trading LLC'])(
        'Given the reference %s / When validated / Then no message',
        (value) => {
            expect(validateReference(value, 'Party / Reference')).toBeNull();
        },
    );

    it('Given a blank value / When validated / Then it reports the field as required', () => {
        expect(validateReference('', 'Party / Reference')).toBe(
            'Party / Reference is required.',
        );
    });

    it('Given one character / When validated / Then it states the minimum', () => {
        expect(validateReference('A', 'Party / Reference')).toBe(
            'Party / Reference must contain at least 2 characters.',
        );
    });

    it('Given over 60 characters / When validated / Then it states the maximum', () => {
        expect(validateReference('A'.repeat(61), 'Party / Reference')).toBe(
            'Party / Reference must be 60 characters or fewer.',
        );
    });

    it.each(SYMBOL_SOUP)(
        'Given the meaningless reference %s / When validated / Then it reports invalid characters',
        (value) => {
            expect(validateReference(value, 'Party / Reference')).toBe(
                'Party / Reference contains invalid characters.',
            );
        },
    );

    it('Given a disallowed character alongside text / When validated / Then it is rejected', () => {
        expect(validateReference('PO<script>', 'Party / Reference')).toBe(
            'Party / Reference contains invalid characters.',
        );
    });
});

describe('Given validatePersonName', () => {
    it.each(["Ahmed Al Rashid", "O'Brien", 'Jean-Luc'])(
        'Given the contact %s / When validated / Then no message',
        (value) => {
            expect(validatePersonName(value)).toBeNull();
        },
    );

    it('Given a blank value / When validated / Then it reports the field as required', () => {
        expect(validatePersonName('')).toBe('Contact person is required.');
    });

    it('Given one character / When validated / Then it asks for a valid name', () => {
        expect(validatePersonName('A')).toBe('Enter a valid contact person.');
    });

    it('Given over 80 characters / When validated / Then it states the maximum', () => {
        expect(validatePersonName('A'.repeat(81))).toBe(
            'Contact person must be 80 characters or fewer.',
        );
    });

    it.each(['12345', 'Ahmed99', '@@@@'])(
        'Given the invalid contact %s / When validated / Then it asks for letters only',
        (value) => {
            expect(validatePersonName(value)).toBe(
                'Enter a valid contact person (letters only).',
            );
        },
    );
});

describe('Given validatePlaceName', () => {
    it('Given a real city / When validated / Then no message', () => {
        expect(validatePlaceName('Dubai', 'City')).toBeNull();
    });

    it('Given a blank value / When validated / Then it reports the field as required', () => {
        expect(validatePlaceName('', 'City')).toBe('City is required.');
    });

    it.each(['12345', '@@@@', 'A', 'A'.repeat(81)])(
        'Given the invalid city %s / When validated / Then it asks for a valid name',
        (value) => {
            expect(validatePlaceName(value, 'City')).toBe('Please enter a valid city name.');
        },
    );
});

describe('Given validateAddress', () => {
    it('Given a real address / When validated / Then no message', () => {
        expect(validateAddress('123 Logistics Park, Jebel Ali')).toBeNull();
    });

    it('Given a blank value / When validated / Then it reports the field as required', () => {
        expect(validateAddress('')).toBe('Street address is required.');
    });

    it.each(['A1', 'A'.repeat(201)])(
        'Given the out-of-range address %s / When validated / Then it asks for a valid address',
        (value) => {
            expect(validateAddress(value)).toBe('Enter a valid street address.');
        },
    );

    it.each(['IUEWR*)(@)@@', '#####'])(
        'Given the symbol address %s / When validated / Then it asks for a valid address',
        (value) => {
            expect(validateAddress(value)).toBe('Enter a valid street address.');
        },
    );
});

describe('Given validatePhone', () => {
    it.each(['+971501234567', '050 123 4567', '(04) 123-4567'])(
        'Given the phone %s / When validated / Then no message',
        (value) => {
            expect(validatePhone(value)).toBeNull();
        },
    );

    it('Given a blank value / When validated / Then it reports the field as required', () => {
        expect(validatePhone('')).toBe('Contact phone is required.');
    });

    it.each(['not-a-phone', '12345', '+9715012345678901'])(
        'Given the invalid phone %s / When validated / Then it asks for a valid number',
        (value) => {
            expect(validatePhone(value)).toBe('Enter a valid phone number.');
        },
    );
});

describe('Given validateBarcode', () => {
    it.each(['12345678', '123456789012', '8901234567890', '12345678901234'])(
        'Given the barcode %s / When validated / Then no message',
        (value) => {
            expect(validateBarcode(value)).toBeNull();
        },
    );

    it('Given a blank barcode / When validated / Then it passes because barcode is optional', () => {
        expect(validateBarcode('')).toBeNull();
    });

    it.each(['kjhjfhdsraeraz', 'ABC123XYZ', '@@@@@@@'])(
        'Given the non-numeric barcode %s / When validated / Then it asks for digits',
        (value) => {
            expect(validateBarcode(value)).toBe('Enter a valid barcode (digits only).');
        },
    );

    it('Given a wrong-length numeric barcode / When validated / Then it states the allowed lengths', () => {
        expect(validateBarcode('1234567')).toBe('Barcode must be 8, 12, 13 or 14 digits.');
    });
});

describe('Given validateSku', () => {
    it('Given a real SKU / When validated / Then no message', () => {
        expect(validateSku('LAP-1001')).toBeNull();
    });

    it('Given a blank SKU / When validated / Then it reports SKU as required', () => {
        expect(validateSku('')).toBe('SKU is required.');
    });

    it('Given an unsupported-symbol SKU / When validated / Then it is rejected', () => {
        expect(validateSku('L:OU+*&%^*&')).not.toBeNull();
    });

    it('Given over 40 characters / When validated / Then it states the maximum', () => {
        expect(validateSku('A'.repeat(41))).toBe('SKU must be 40 characters or fewer.');
    });
});

describe('Given the optional wrapper', () => {
    it('Given a blank value / When wrapped / Then the validator is skipped', () => {
        expect(optional('', (v) => validateReference(v))).toBeNull();
        expect(optional('   ', (v) => validateReference(v))).toBeNull();
    });

    it('Given a present invalid value / When wrapped / Then the validator still runs', () => {
        expect(optional('@@@@', (v) => validateReference(v))).not.toBeNull();
    });
});

describe('Given firstError and isClean', () => {
    it('Given no errors / When collapsed / Then null and clean', () => {
        const errors = { name: null, code: null };
        expect(firstError(errors)).toBeNull();
        expect(isClean(errors)).toBe(true);
    });

    it('Given several errors / When collapsed / Then the first in key order wins', () => {
        const errors = { name: 'Name is required.', code: 'Code is required.' };
        expect(firstError(errors)).toBe('Name is required.');
        expect(isClean(errors)).toBe(false);
    });
});
