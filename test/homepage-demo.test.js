import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const fixture = JSON.parse(
  readFileSync(new URL("../fixtures/homepage-demo.json", import.meta.url), "utf8"),
);
const homepage = readFileSync(new URL("../index.html", import.meta.url), "utf8");

const sum = (values) => values.reduce((total, value) => total + value, 0);
const usd = (value) => `$${Math.abs(value).toLocaleString("en-US")}`;
const signedUsd = (value) => `${value < 0 ? "−" : "+"}${usd(value)}`;

test("homepage demonstration amounts reconcile and appear in the page", () => {
  for (const [label, count] of Object.entries(fixture.heroReview)) {
    const publicLabel = label === "needsAction" ? "Needs action" : `${label[0].toUpperCase()}${label.slice(1)}`;
    assert.match(
      homepage,
      new RegExp(`${publicLabel}.*<span class="count">${count}</span>`, "s"),
    );
  }

  for (const rate of fixture.rateExamples) {
    assert.match(
      homepage,
      new RegExp(`${escapeRegExp(rate.role)}.*${escapeRegExp(rate.display)}`, "s"),
    );
  }

  const scenario = fixture.scenarioComparison;
  assert.equal(
    sum(scenario.rows.map((row) => row.delta)),
    scenario.grandTotalDelta,
    "scenario rows must sum to the displayed grand total delta",
  );

  const sample = fixture.sampleBid;
  for (const lineItem of sample.visibleLineItems) {
    assert.equal(
      lineItem.quantity * lineItem.unitCost,
      lineItem.lineTotal,
      `${lineItem.description} quantity and unit cost must reconcile`,
    );
    assert.match(
      homepage,
      new RegExp(
        `${escapeRegExp(lineItem.description)}.*>${lineItem.quantity}<.*>${lineItem.unitCost.toLocaleString("en-US")}<.*>${lineItem.lineTotal.toLocaleString("en-US")}<`,
        "s",
      ),
    );
  }
  assert.ok(
    homepage.includes(
      `${sample.schedule.prepDays} / ${sample.schedule.shootDays} / ${sample.schedule.wrapDays} DAYS`,
    ),
  );
  assert.equal(
    sum(sample.sections.map((section) => section.amount)),
    sample.rawSubtotal,
    "AICP section rows must sum to the displayed raw subtotal",
  );
  assert.equal(
    sum([
      sample.rawSubtotal,
      sample.fringe,
      sample.overhead,
      sample.producerFee,
      sample.contingency,
    ]),
    sample.grandTotal,
    "sample-bid components must sum to the displayed grand total",
  );

  const changeOrder = fixture.changeOrder;
  assert.equal(
    changeOrder.baselineTotal + changeOrder.delta,
    changeOrder.revisedTotal,
    "change-order baseline and delta must sum to the revised total",
  );

  for (const row of scenario.rows) {
    assert.match(homepage, new RegExp(`${row.label}.*${escapeRegExp(signedUsd(row.delta))}`, "s"));
  }
  assert.ok(homepage.includes(signedUsd(scenario.grandTotalDelta)));

  for (const section of sample.sections) {
    assert.match(homepage, new RegExp(`<b>${section.code}</b>.*${escapeRegExp(usd(section.amount))}`, "s"));
  }
  for (const amount of [
    sample.rawSubtotal,
    sample.fringe,
    sample.overhead,
    sample.producerFee,
    sample.contingency,
    sample.grandTotal,
  ]) {
    assert.ok(homepage.includes(usd(amount)));
  }

  assert.ok(homepage.includes(signedUsd(changeOrder.delta)));
  assert.ok(homepage.includes(usd(changeOrder.revisedTotal)));
  for (const term of changeOrder.scopeTerms) assert.ok(homepage.includes(term));
  for (const item of fixture.reviewReceipt) {
    assert.ok(homepage.includes(item.text));
    assert.ok(homepage.includes(`<em>${item.status}</em>`));
  }

  assert.ok(homepage.includes("Shop setup"));
  assert.ok(homepage.includes("fringe and markup defaults"));
  assert.ok(homepage.includes("production template"));
});

test(
  "product source trace exists at the pinned commit",
  { skip: !process.env.BIDFRAME_PRODUCT_ROOT },
  () => {
    const productRoot = path.resolve(process.env.BIDFRAME_PRODUCT_ROOT);
    assert.ok(existsSync(productRoot), `missing product repository: ${productRoot}`);

    const productHead = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: productRoot,
      encoding: "utf8",
    }).trim();
    assert.equal(productHead, fixture.verifiedAgainstProductCommit);

    for (const relativePath of Object.values(fixture.productCodeTrace)) {
      assert.ok(
        existsSync(path.join(productRoot, relativePath)),
        `missing traced product source: ${relativePath}`,
      );
    }
  },
);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
