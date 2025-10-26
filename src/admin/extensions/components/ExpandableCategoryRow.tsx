import React, { useState } from 'react';
import { Box, IconButton, Flex } from '@strapi/design-system';
import { ChevronDown, ChevronRight } from '@strapi/icons';
import { CategoryArticlesList } from './CategoryArticlesList';

interface ExpandableCategoryRowProps {
  data: any;
}

export const ExpandableCategoryRow: React.FC<ExpandableCategoryRowProps> = ({ data }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <Box>
      <Flex alignItems="center" gap={2}>
        <IconButton
          onClick={toggleExpand}
          label={isExpanded ? 'Collapse' : 'Expand'}
          icon={isExpanded ? <ChevronDown /> : <ChevronRight />}
          noBorder
        />
        <span>View Articles</span>
      </Flex>
      {isExpanded && (
        <Box marginTop={2}>
          <CategoryArticlesList
            categoryId={data.id}
            documentId={data.documentId}
          />
        </Box>
      )}
    </Box>
  );
};
