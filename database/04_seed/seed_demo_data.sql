/* ============================================================================
   Script 040: Demo seed.
   Loads enough data to make the API + mobile app render meaningful results.
   DO NOT RUN IN PRODUCTION.
   ============================================================================ */
USE HajeryPulse_Reporting;
GO

-- ============================================================================
-- 1. dim.Date (2024-01-01 to 2027-12-31)
-- ============================================================================
;WITH dates AS (
    SELECT CAST('2024-01-01' AS DATE) AS d
    UNION ALL
    SELECT DATEADD(DAY, 1, d) FROM dates WHERE d < '2027-12-31'
)
INSERT INTO dim.Date (DateKey, [Date], [Year], [Quarter], [Month], MonthName, [Week], DayOfWeek, DayName, IsWeekend)
SELECT
    CONVERT(INT, FORMAT(d, 'yyyyMMdd')),
    d,
    DATEPART(YEAR, d),
    DATEPART(QUARTER, d),
    DATEPART(MONTH, d),
    DATENAME(MONTH, d),
    DATEPART(WEEK, d),
    DATEPART(WEEKDAY, d),
    DATENAME(WEEKDAY, d),
    CASE WHEN DATENAME(WEEKDAY, d) IN ('Friday', 'Saturday') THEN 1 ELSE 0 END
FROM dates
WHERE NOT EXISTS (SELECT 1 FROM dim.Date td WHERE td.[Date] = dates.d)
OPTION (MAXRECURSION 0);
GO

-- ============================================================================
-- 2. ref.* lookups
-- ============================================================================
MERGE ref.Channel AS t USING (VALUES
    ('instore',    'Instore'),
    ('callcenter', 'Call center'),
    ('aggregator', 'Aggregator'),
    ('dinein',     'Dine-in'),
    ('delivery',   'Delivery'),
    ('takeaway',   'Takeaway')
) AS s(Code, Label) ON t.Code = s.Code
WHEN NOT MATCHED THEN INSERT (Code, Label) VALUES (s.Code, s.Label);
GO

MERGE ref.PaymentType AS t USING (VALUES
    ('cash',      'Cash',                '#30e0c4', 1),
    ('knet',      'Knet (Debit)',        '#d4af6a', 2),
    ('visa',      'Visa Card',           '#5b8cff', 3),
    ('master',    'Master Card',         '#9a7cff', 4),
    ('applepay',  'Apple Pay',           '#ff7cae', 5),
    ('tap',       'Online Tap',          '#ffb13c', 6),
    ('amex',      'AMEX',                '#bdc3c7', 7),
    ('insurance', 'Insurance Sales',     '#ff7cae', 8),
    ('loyalty',   'Loyalty',             '#48d1cc', 9),
    ('pulse',     'Pulse Care',          '#c39bd3', 10),
    ('deliveroo', 'Deliveroo',           '#ffb13c', 11),
    ('talabat',   'Talabat',             '#5fd17a', 12),
    ('ecom',      'eCommerce Online Tap','#ff5c6c', 13)
) AS s(Code, Label, Color, SortOrder) ON t.Code = s.Code
WHEN NOT MATCHED THEN INSERT (Code, Label, Color, SortOrder) VALUES (s.Code, s.Label, s.Color, s.SortOrder);
GO

MERGE ref.Aggregator AS t USING (VALUES
    ('talabat',    'Talabat',                 '#ff7cae', 1),
    ('deliveroo',  'Deliveroo',               '#30e0c4', 2),
    ('jahez',      'Jahez',                   '#5b8cff', 3),
    ('cart',       'Cart',                    '#9a7cff', 4),
    ('keeta',      'Keeta',                   '#ffb13c', 5),
    ('bilbayt',    'Bilbayt',                 '#d4af6a', 6),
    ('master',     'Master Card',             '#ff5c6c', 7),
    ('dow',        'Direct Order Website',    '#48d1cc', 8),
    ('cofe',       'Cofe',                    '#5fd17a', 9),
    ('callcenter', 'Call center sales',       '#c39bd3', 10),
    ('event',      'Event',                   '#f5b041', 11),
    ('credit',     'Credit',                  '#bdc3c7', 12)
) AS s(Code, Label, Color, SortOrder) ON t.Code = s.Code
WHEN NOT MATCHED THEN INSERT (Code, Label, Color, SortOrder) VALUES (s.Code, s.Label, s.Color, s.SortOrder);
GO

MERGE ref.Category AS t USING (VALUES
    ('rx',     N'Prescription (Rx)',       1, 1),
    ('otc',    N'OTC Pain Relief',         0, 2),
    ('vits',   N'Vitamins & Supplements',  0, 3),
    ('baby',   N'Baby & Mother care',      0, 4),
    ('beauty', N'Beauty & Personal',       0, 5),
    ('skin',   N'Skincare',                0, 6),
    ('diab',   N'Diabetic care',           1, 7),
    ('oral',   N'Oral hygiene',            0, 8),
    ('aid',    N'First aid & wound care',  0, 9),
    ('dev',    N'Medical devices',         0, 10)
) AS s(Code, Label, IsRx, SortOrder) ON t.Code = s.Code
WHEN NOT MATCHED THEN INSERT (Code, Label, IsRx, SortOrder) VALUES (s.Code, s.Label, s.IsRx, s.SortOrder);
GO

-- ============================================================================
-- 3. dim.OrgUnit — Hajery Group hierarchy (BUs → Divisions → BTs)
-- ============================================================================
DECLARE @group INT, @hc INT, @fm INT, @pc INT;
DECLARE @pd INT, @lc INT, @ch INT, @hcm INT, @da INT, @fo INT, @co INT, @pcd INT;

-- Business Units (top level — no parent)
INSERT INTO dim.OrgUnit (Code, Name, [Level], BuCode)
SELECT v.Code, v.Name, 'BusinessUnit', v.Code FROM (VALUES
    ('HC00', N'HEALTHCARE'),
    ('FM00', N'FMCG'),
    ('PC00', N'PERFUMES & COSMETICS')
) v(Code, Name)
WHERE NOT EXISTS (SELECT 1 FROM dim.OrgUnit o WHERE o.Code = v.Code);

SELECT @hc = OrgUnitKey FROM dim.OrgUnit WHERE Code = 'HC00';
SELECT @fm = OrgUnitKey FROM dim.OrgUnit WHERE Code = 'FM00';
SELECT @pc = OrgUnitKey FROM dim.OrgUnit WHERE Code = 'PC00';

-- Divisions
INSERT INTO dim.OrgUnit (Code, Name, [Level], ParentKey, BuCode)
SELECT v.Code, v.Name, 'Division', v.ParentKey, v.BuCode FROM (VALUES
    ('PD100', N'Pharmaceutical',       @hc, 'HC00'),
    ('LC100', N'Lab & Clinical',       @hc, 'HC00'),
    ('CH100', N'Consumer Health',      @hc, 'HC00'),
    ('HC100', N'Home Care',            @fm, 'FM00'),
    ('DA100', N'Dairy',                @fm, 'FM00'),
    ('FO100', N'Food',                 @fm, 'FM00'),
    ('CO100', N'Confectionery',        @fm, 'FM00'),
    ('PC100', N'Cosmetics & Perfumes', @pc, 'PC00')
) v(Code, Name, ParentKey, BuCode)
WHERE NOT EXISTS (SELECT 1 FROM dim.OrgUnit o WHERE o.Code = v.Code);

SELECT @pd = OrgUnitKey FROM dim.OrgUnit WHERE Code = 'PD100';
SELECT @lc = OrgUnitKey FROM dim.OrgUnit WHERE Code = 'LC100';
SELECT @ch = OrgUnitKey FROM dim.OrgUnit WHERE Code = 'CH100';
SELECT @hcm = OrgUnitKey FROM dim.OrgUnit WHERE Code = 'HC100';
SELECT @da = OrgUnitKey FROM dim.OrgUnit WHERE Code = 'DA100';
SELECT @fo = OrgUnitKey FROM dim.OrgUnit WHERE Code = 'FO100';
SELECT @co = OrgUnitKey FROM dim.OrgUnit WHERE Code = 'CO100';
SELECT @pcd = OrgUnitKey FROM dim.OrgUnit WHERE Code = 'PC100';

-- Business Types (key codes; trim if you want a smaller demo)
INSERT INTO dim.OrgUnit (Code, Name, [Level], ParentKey, BuCode)
SELECT v.Code, v.Name, 'BusinessType', v.ParentKey, v.BuCode FROM (VALUES
    ('PA50', N'Pharma Wholesale',  @pd, 'HC00'),
    ('PN50', N'Pharma Tender',     @pd, 'HC00'),
    ('TM50', N'Trade Marketing',   @pd, 'HC00'),
    ('TA50', N'Lab Wholesale',     @lc, 'HC00'),
    ('TO50', N'Lab Tender',        @lc, 'HC00'),
    ('MW50', N'Medical Wholesale', @lc, 'HC00'),
    ('CA50', N'Consumer Health Wholesale', @ch, 'HC00'),
    ('CB50', N'Consumer Health Tender',    @ch, 'HC00'),
    ('CG50', N'Specialty OTC',             @ch, 'HC00'),
    ('CN50', N'Home Care Wholesale',       @hcm, 'FM00'),
    ('DA50', N'Dairy Wholesale',           @da,  'FM00'),
    ('FW70', N'Frozen Foods',              @fo,  'FM00'),
    ('CC50', N'Cosmetics Wholesale',       @pcd, 'PC00'),
    ('PC50', N'Perfumes Wholesale',        @pcd, 'PC00')
) v(Code, Name, ParentKey, BuCode)
WHERE NOT EXISTS (SELECT 1 FROM dim.OrgUnit o WHERE o.Code = v.Code);
GO

-- ============================================================================
-- 4. dim.Pharmacy — 29 branches
-- ============================================================================
INSERT INTO dim.Pharmacy (Code, Name, Area)
SELECT v.Code, v.Name, v.Area FROM (VALUES
    ('anoud',    N'Al Anoud Pharmacy (Pearl)',           N'Pearl'),
    ('mangaf',   N'Al-Hajery Pharmacy (Mangaf)',         N'Mangaf'),
    ('hamra',    N'Al Hamra Pharmacy',                   N'Hamra'),
    ('masayel',  N'AlHajery Masayel Coop Pharmacy',      N'Masayel'),
    ('salmiya',  N'Salmiya Co. Pharmacy',                N'Salmiya'),
    ('mahmal',   N'Al Mahmal Pharmacy (Warehouse Mall)', N'Warehouse Mall'),
    ('salwa',    N'Salwa Co.op. Pharmacy',               N'Salwa'),
    ('andalous', N'Andalous Coop Pharmacy (Andalous)',   N'Andalous'),
    ('dawliyah', N'Al Dawliyah Pharmacy (Amiri)',        N'Amiri'),
    ('shamiya',  N'Al Shamiya Pharmacy (Al Raya)',       N'Al Raya'),
    ('corp',     N'Corporate Sales',                     N'HQ'),
    ('boom',     N'Al Boom Pharmacy (Al-Kout Mall)',     N'Al-Kout'),
    ('helal',    N'Helal Al Hajery Pharmacy (Salmiya)',  N'Salmiya'),
    ('fereej',   N'Al-Fereej Pharmacy (Jabriya)',        N'Jabriya'),
    ('darwaza',  N'Al Darwaza Pharmacy',                 N'Darwaza'),
    ('khaleej',  N'Al Khaleej Pharmacy (Sama)',          N'Sama'),
    ('ardiya',   N'Ardiya Pharmacy (Ardiya)',            N'Ardiya'),
    ('jalboot',  N'Al Jalboot Pharmacy (Khairan)',       N'Khairan'),
    ('nokhetha', N'Al Nokhetha Pharmacy (Assimah)',      N'Assimah'),
    ('arena',    N'Arena Pharmacy (Dana)',               N'Dana'),
    ('marsa',    N'Al Marsa Pharmacy (Khairan Hybrid)',  N'Khairan'),
    ('sahel',    N'Al Sahel Pharmacy',                   N'Sahel'),
    ('rehab',    N'Rehab Alhajery Pharmacy',             N'Rehab'),
    ('daiya',    N'Daiya Co. Pharmacy (Daiya)',          N'Daiya'),
    ('mohallab', N'Al Mohallab Pharmacy',                N'Mohallab'),
    ('jaber',    N'Jaber Al Ahmed',                      N'Jaber Al Ahmed'),
    ('sidra',    N'Sidra Pharmacy',                      N'Sidra'),
    ('miskan',   N'Miskan Pharmacy (Zahra)',             N'Zahra'),
    ('ouha',     N'Ouha Pharmacy (Bneid Al Gar)',        N'Bneid Al Gar')
) v(Code, Name, Area)
WHERE NOT EXISTS (SELECT 1 FROM dim.Pharmacy p WHERE p.Code = v.Code);
GO

-- ============================================================================
-- 5. dim.FBBrand + dim.FBOutlet
-- ============================================================================
INSERT INTO dim.FBBrand (Code, Name, BrandColor)
SELECT v.Code, v.Name, v.Color FROM (VALUES
    ('danish',    N'Danish Bakery',    '#ff7cae'),
    ('haagen',    N'Haagen Dazs',      '#d4af6a'),
    ('espressam', N'Espressamente',    '#30e0c4'),
    ('solia',     N'Solia',            '#5b8cff'),
    ('sutis',     N'Sutis',            '#9a7cff'),
    ('khaneen',   N'Khaneen',          '#ffb13c'),
    ('damlooj_l', N'Damlooj Lounge',   '#ff5c6c'),
    ('jafra',     N'Jafra Restaurant', '#48d1cc'),
    ('mia',       N'Mia Restaurant',   '#5fd17a'),
    ('kitchen',   N'Kitchen Park',     '#c39bd3'),
    ('delfino',   N'Delfino',          '#f5b041'),
    ('damlooj_b', N'Damlooj Bakery',   '#bdc3c7')
) v(Code, Name, Color)
WHERE NOT EXISTS (SELECT 1 FROM dim.FBBrand b WHERE b.Code = v.Code);
GO

-- (Outlet seed truncated for brevity; insert all 43 from F&BOutlets.csv)
INSERT INTO dim.FBOutlet (Code, Name, FBBrandKey)
SELECT v.Code, v.Name, b.FBBrandKey
FROM (VALUES
    -- Danish Bakery (21)
    ('DB70', N'Retail And Super Market',     'danish'),
    ('DB77', N'Andalus Cooperative',         'danish'),
    ('DB87', N'National Guard COOP',         'danish'),
    ('DB79', N'Mishref Cooperative',         'danish'),
    ('DB84', N'Qairawan Cooperative',        'danish'),
    ('DB10', N'Daiya Cooperative',           'danish'),
    ('DB78', N'Shamiya Cooperative',         'danish'),
    ('DB55', N'Bayan Bilingual School',      'danish'),
    ('DB56', N'Bayan International School',  'danish'),
    ('CT10', N'CATERING',                    'danish'),
    ('DB91', N'Australian University',       'danish'),
    ('DB81', N'Ibn Sina Hospital',           'danish'),
    ('DB82', N'Al Bahar Eye Hospital',       'danish'),
    ('DB75', N'Sabah Al Ahmed',              'danish'),
    ('DB90', N'Events',                      'danish'),
    ('DB95', N'Abu Fatira',                  'danish'),
    ('DB88', N'Saad Al-Abdullah',            'danish'),
    ('DB86', N'North West Sulaibikhat',      'danish'),
    ('DB83', N'WEST ABDULLAH MUBARAK',       'danish'),
    ('DB60', N'Dar Al Shaikha',              'danish'),
    ('DB40', N'Yarmouk',                     'danish'),
    -- Haagen Dazs (7)
    ('HD36', N'Avenues',                     'haagen'),
    ('HD38', N'Al Kout Mall',                'haagen'),
    ('HD39', N'Sahara',                      'haagen'),
    ('HD32', N'Araya Complex',               'haagen'),
    ('HD30', N'Sharq',                       'haagen'),
    ('HD43', N'The Scientific Center',       'haagen'),
    ('HD41', N'Sabah Al Ahmed',              'haagen'),
    -- Espressamente (3)
    ('EX03', N'360 Mall',                    'espressam'),
    ('EX05', N'Assima Mall',                 'espressam'),
    ('EX06', N'Andalous Mall',               'espressam'),
    -- Solia (2)
    ('SO02', N'Avenues',                     'solia'),
    ('SO03', N'Sahara',                      'solia'),
    -- Sutis (2)
    ('RC01', N'Avenues',                     'sutis'),
    ('RC04', N'Sahara',                      'sutis'),
    -- Khaneen (2)
    ('TL45', N'Avenues',                     'khaneen'),
    ('TL30', N'Sahara',                      'khaneen'),
    -- Single-outlet brands
    ('DJ01', N'Avenues',                     'damlooj_l'),
    ('JF01', N'Avenues',                     'jafra'),
    ('MI10', N'Assima',                      'mia'),
    ('KP10', N'Abu Futaira',                 'kitchen'),
    ('DN01', N'Hessah Mubarak',              'delfino'),
    ('DM40', N'Yarmouk',                     'damlooj_b')
) v(Code, Name, BrandCode)
JOIN dim.FBBrand b ON b.Code = v.BrandCode
WHERE NOT EXISTS (SELECT 1 FROM dim.FBOutlet o WHERE o.Code = v.Code);
GO

-- ============================================================================
-- 6. dim.Brand + dim.Customer for W&T
-- ============================================================================
INSERT INTO dim.Brand (Name, Segment)
SELECT v.Name, v.Segment FROM (VALUES
    (N'BBraun',           N'Surgical & infusion · Healthcare'),
    (N'Abbott',           N'Pharma & diagnostics · Healthcare'),
    (N'GlaxoSmithKline',  N'Pharma & OTC · Healthcare'),
    (N'Coloplast',        N'Ostomy & continence · Healthcare'),
    (N'Fresenius',        N'Renal & nutrition · Healthcare'),
    (N'Tefal',            N'Cookware & food · FMCG'),
    (N'Coty',             N'Perfumes & cosmetics · P&C'),
    (N'Applied Medical',  N'Surgical devices · Healthcare'),
    (N'Karo Healthcare',  N'OTC & consumer health'),
    (N'Jamjoom Pharma',   N'Pharma · Healthcare')
) v(Name, Segment)
WHERE NOT EXISTS (SELECT 1 FROM dim.Brand b WHERE b.Name = v.Name);
GO

INSERT INTO dim.Customer (Code, Name, [Type], Country)
SELECT v.Code, v.Name, v.Type, 'Kuwait' FROM (VALUES
    ('moh',        N'Ministry of Health',     N'Government'),
    ('boots',      N'Boots Pharmacy',         N'Pharmacy'),
    ('sultan',     N'The Sultan Center',      N'Hypermarket'),
    ('whish',      N'Whish Pharmacy',         N'Pharmacy'),
    ('carrefour',  N'Carrefour Kuwait',       N'Hypermarket'),
    ('mod',        N'Ministry of Defense',    N'Government'),
    ('royale',     N'Royale Hayat Hospital',  N'Hospital'),
    ('lulu',       N'Lulu Hypermarket',       N'Hypermarket'),
    ('koc',        N'KOC Health Services',    N'Government'),
    ('darshifa',   N'Dar Al Shifa Hospital',  N'Hospital')
) v(Code, Name, Type)
WHERE NOT EXISTS (SELECT 1 FROM dim.Customer c WHERE c.Code = v.Code);
GO

-- ============================================================================
-- 7. dim.User — at least one demo user (replace EntraObjectId with a real GUID)
-- ============================================================================
INSERT INTO dim.[User] (EntraObjectId, Email, DisplayName, Roles)
SELECT NEWID(), 'demo@hajerygroup.com', N'Demo Executive', N'["ceo","approver_lpo","approver_asset"]'
WHERE NOT EXISTS (SELECT 1 FROM dim.[User] WHERE Email = 'demo@hajerygroup.com');
GO

-- ============================================================================
-- 8. fact.* — minimal sample rows for "yesterday" so the dashboards have data
--    Real ETL fills the full history. This script just makes the prototype
--    render.
-- ============================================================================
DECLARE @asOfKey INT = CONVERT(INT, FORMAT(DATEADD(DAY, -1, CAST(SYSUTCDATETIME() AS DATE)), 'yyyyMMdd'));

-- Pick a HEALTHCARE BU and one customer for a sample W&T row
DECLARE @hcKey INT  = (SELECT OrgUnitKey FROM dim.OrgUnit WHERE Code = 'HC00');
DECLARE @custKey INT = (SELECT TOP 1 CustomerKey FROM dim.Customer);
DECLARE @brandKey INT = (SELECT TOP 1 BrandKey FROM dim.Brand);

IF NOT EXISTS (SELECT 1 FROM fact.SalesWT WHERE DateKey = @asOfKey)
INSERT INTO fact.SalesWT (DateKey, OrgUnitKey, CustomerKey, BrandKey, Channel,
                          GrossKwd, ReturnsKwd, CancellationsKwd, NetKwd, CogsKwd)
VALUES
    (@asOfKey, @hcKey, @custKey, @brandKey, 'W',
     8910000, 312000, 178000, 8420000, 5480000),
    (@asOfKey, @hcKey, @custKey, @brandKey, 'T',
     2490000, 48000, 26000, 2400000, 1430000);

-- Pharmacy + F&B sample rows (one per pharmacy / outlet for asOf day)
INSERT INTO fact.PharmacySales (DateKey, PharmacyKey, GrossKwd, DiscountKwd, ReturnsKwd, NetKwd, CogsKwd, Transactions)
SELECT @asOfKey, p.PharmacyKey,
       50000 + ABS(CHECKSUM(NEWID())) % 80000,
       2000  + ABS(CHECKSUM(NEWID())) % 6000,
       500   + ABS(CHECKSUM(NEWID())) % 1500,
       45000 + ABS(CHECKSUM(NEWID())) % 70000,
       30000 + ABS(CHECKSUM(NEWID())) % 50000,
       100   + ABS(CHECKSUM(NEWID())) % 800
FROM dim.Pharmacy p
WHERE NOT EXISTS (SELECT 1 FROM fact.PharmacySales f WHERE f.DateKey = @asOfKey AND f.PharmacyKey = p.PharmacyKey);

INSERT INTO fact.FBSales (DateKey, FBOutletKey, GrossKwd, NetKwd, Covers, Transactions)
SELECT @asOfKey, o.FBOutletKey,
       8000  + ABS(CHECKSUM(NEWID())) % 25000,
       7500  + ABS(CHECKSUM(NEWID())) % 22000,
       50    + ABS(CHECKSUM(NEWID())) % 600,
       50    + ABS(CHECKSUM(NEWID())) % 600
FROM dim.FBOutlet o
WHERE NOT EXISTS (SELECT 1 FROM fact.FBSales f WHERE f.DateKey = @asOfKey AND f.FBOutletKey = o.FBOutletKey);
GO

-- ============================================================================
-- 9. app.ApprovalRequest — a couple of sample LPOs
-- ============================================================================
DECLARE @demoUser INT = (SELECT TOP 1 UserKey FROM dim.[User]);

INSERT INTO app.ApprovalRequest (RequestId, [Type], Title, [Description], AmountKwd, RequesterUserKey, BuCode, [Status])
SELECT v.Id, v.Type, v.Title, v.Description, v.Amount, @demoUser, v.Bu, 'Pending' FROM (VALUES
    ('LPO-2026-1042', 'lpo',   N'Bulk paracetamol — Q2 inventory',
     N'Quarterly bulk order from Karo Healthcare. Volume discount confirmed.', 84.000,  'HC00'),
    ('AST-2026-0218', 'asset', N'Cold-chain monitoring units',
     N'5 IoT temperature loggers for Mangaf and Salmiya pharmacies.',          12.500,  'HC00')
) v(Id, Type, Title, Description, Amount, Bu)
WHERE NOT EXISTS (SELECT 1 FROM app.ApprovalRequest r WHERE r.RequestId = v.Id);

INSERT INTO app.ApprovalLineItem (RequestId, ItemNo, [Description], Qty, UnitPriceKwd, Vendor)
SELECT 'LPO-2026-1042', 1, N'Paracetamol 500mg, blister 24', 4000, 0.018, N'Karo Healthcare'
WHERE NOT EXISTS (SELECT 1 FROM app.ApprovalLineItem WHERE RequestId = 'LPO-2026-1042' AND ItemNo = 1);

PRINT 'Demo seed loaded. The mobile app should now render dashboards.';
